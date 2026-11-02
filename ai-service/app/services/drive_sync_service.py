import io
import json
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

from app.core.config import settings, BASE_DIR
from app.core.logging import logger
from app.services.vector_store import vector_store
from app.services.chunking_service import chunking_service

class DriveSyncService:
    def __init__(self):
        self._drive_service = None
        self._auth_type: Optional[str] = None
        self._last_sync_result: Optional[Dict[str, Any]] = None

    def get_auth_status(self) -> Dict[str, Any]:
        """Kiểm tra trạng thái cấu hình kết nối Google Drive."""
        folder_id = settings.GOOGLE_DRIVE_FOLDER_ID
        has_folder = bool(folder_id and folder_id.strip())

        # Kiểm tra Service Account
        has_sa_json = bool(settings.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON and settings.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON.strip())
        sa_file_path = self._resolve_credentials_path()
        has_sa_file = sa_file_path is not None and sa_file_path.exists()
        has_api_key = bool(settings.GOOGLE_DRIVE_API_KEY and settings.GOOGLE_DRIVE_API_KEY.strip())

        auth_method = "NONE"
        if has_sa_json:
            auth_method = "SERVICE_ACCOUNT_ENV_JSON"
        elif has_sa_file:
            auth_method = f"SERVICE_ACCOUNT_FILE ({sa_file_path.name})"
        elif has_api_key:
            auth_method = "API_KEY"

        return {
            "isConfigured": has_folder and (auth_method != "NONE"),
            "folderId": folder_id or None,
            "authMethod": auth_method,
            "hasFolderId": has_folder,
            "credentialsFileFound": has_sa_file,
            "credentialsFilePath": str(sa_file_path) if sa_file_path else None,
            "lastSync": self._last_sync_result,
        }

    def _resolve_credentials_path(self) -> Optional[Path]:
        """Tìm file Service Account JSON nếu có."""
        candidates = [
            Path(settings.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE),
            BASE_DIR / settings.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE,
            BASE_DIR / "service_account.json",
            BASE_DIR / "credentials.json",
            Path.cwd() / "service_account.json",
        ]
        for p in candidates:
            if p.is_file():
                return p.resolve()
        return None

    def _init_client(self):
        """Khởi tạo Google Drive API Client (v3)."""
        from googleapiclient.discovery import build
        from google.oauth2 import service_account

        scopes = ['https://www.googleapis.com/auth/drive.readonly']

        # 1. Ưu tiên: Service Account từ JSON string trong .env
        if settings.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON and settings.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON.strip():
            try:
                info = json.loads(settings.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON)
                creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
                self._drive_service = build('drive', 'v3', credentials=creds, cache_discovery=False)
                self._auth_type = "SERVICE_ACCOUNT_ENV_JSON"
                logger.info("Initialized Google Drive client via Service Account JSON String.")
                return
            except Exception as e:
                logger.warning(f"Failed to init Drive via GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: {e}")

        # 2. Service Account từ file cục bộ (service_account.json)
        cred_path = self._resolve_credentials_path()
        if cred_path and cred_path.is_file():
            try:
                creds = service_account.Credentials.from_service_account_file(str(cred_path), scopes=scopes)
                self._drive_service = build('drive', 'v3', credentials=creds, cache_discovery=False)
                self._auth_type = "SERVICE_ACCOUNT_FILE"
                logger.info(f"Initialized Google Drive client via Service Account file: {cred_path.name}")
                return
            except Exception as e:
                logger.warning(f"Failed to init Drive via credentials file {cred_path}: {e}")

        # 3. API Key (chỉ dùng được với file/folder công khai)
        if settings.GOOGLE_DRIVE_API_KEY and settings.GOOGLE_DRIVE_API_KEY.strip():
            try:
                self._drive_service = build('drive', 'v3', developerKey=settings.GOOGLE_DRIVE_API_KEY.strip(), cache_discovery=False)
                self._auth_type = "API_KEY"
                logger.info("Initialized Google Drive client via API Key.")
                return
            except Exception as e:
                logger.warning(f"Failed to init Drive via API Key: {e}")

        self._drive_service = None
        self._auth_type = None

    def _get_service(self):
        if self._drive_service is None:
            self._init_client()
        if self._drive_service is None:
            raise ValueError(
                "Chưa cấu hình thông tin xác thực Google Drive! "
                "Vui lòng đặt file 'service_account.json' vào thư mục ai-service hoặc cấu hình GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON trong .env."
            )
        return self._drive_service

    def _infer_category(self, filename: str) -> str:
        """Tự động suy luận danh mục tài liệu dựa trên tên file."""
        fn = filename.lower()
        if any(w in fn for w in ["nuoc", "moi_truong", "water", "ph_", "do_", "kiem"]):
            return "WATER_QUALITY"
        if any(w in fn for w in ["thuc_an", "fcr", "feed", "dinh_duong", "an"]):
            return "FEEDING"
        if any(w in fn for w in ["benh", "duc_co", "phan_trang", "hoai_tu", "disease", "ehp"]):
            return "SHRIMP_DISEASE"
        if any(w in fn for w in ["thoi_tiet", "weather", "nhiet_do", "mua", "bao"]):
            return "WEATHER"
        if any(w in fn for w in ["quy_dinh", "tieu_chuan", "luat", "regulation"]):
            return "REGULATIONS"
        return "GENERAL"

    def list_folder_files(self, folder_id: str) -> List[Dict[str, Any]]:
        """Lấy danh sách các tài liệu trong thư mục Google Drive."""
        service = self._get_service()
        files = []
        page_token = None
        query = f"'{folder_id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'"

        while True:
            response = service.files().list(
                q=query,
                spaces='drive',
                fields='nextPageToken, files(id, name, mimeType, modifiedTime, size)',
                pageToken=page_token
            ).execute()

            files.extend(response.get('files', []))
            page_token = response.get('nextPageToken')
            if not page_token:
                break

        return files

    def download_file_content(self, file_id: str, mime_type: str, file_name: str) -> str:
        """Tải và trích xuất nội dung văn bản từ Google Drive."""
        service = self._get_service()

        # Trường hợp 1: Google Docs -> Xuất thẳng ra text/plain
        if mime_type == 'application/vnd.google-apps.document':
            request = service.files().export_media(fileId=file_id, mimeType='text/plain')
            content_bytes = request.execute()
            return content_bytes.decode('utf-8', errors='ignore')

        # Trường hợp 2: Tải file nhị phân (PDF, DOCX, TXT, MD)
        from googleapiclient.http import MediaIoBaseDownload
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()

        file_bytes = fh.getvalue()
        lower_name = file_name.lower()

        if mime_type == 'application/pdf' or lower_name.endswith('.pdf'):
            return chunking_service.extract_text_from_pdf(file_bytes)
        elif 'wordprocessingml' in mime_type or lower_name.endswith('.docx'):
            return chunking_service.extract_text_from_docx(file_bytes)
        else:
            return file_bytes.decode('utf-8', errors='ignore')

    def sync_folder(
        self,
        folder_id: Optional[str] = None,
        force: bool = False,
        prune_deleted: bool = False
    ) -> Dict[str, Any]:
        """
        Đồng bộ toàn bộ tài liệu từ Google Drive Folder vào RAG Vector Store.
        - Logic vi sai (Incremental Diff): Chỉ tải và tính toán lại các file mới hoặc có modifiedTime thay đổi.
        - Tự động bỏ qua các file không đổi để tiết kiệm chi phí OpenAI Token và thời gian.
        """
        target_folder = folder_id or settings.GOOGLE_DRIVE_FOLDER_ID
        if not target_folder or not target_folder.strip():
            raise ValueError("Chưa cung cấp Google Drive Folder ID. Vui lòng cấu hình GOOGLE_DRIVE_FOLDER_ID trong .env.")

        start_time = datetime.now()
        logger.info(f"Starting Google Drive RAG Knowledge Sync for folder: {target_folder}")

        drive_files = self.list_folder_files(target_folder)
        logger.info(f"Found {len(drive_files)} supported files in Google Drive folder.")

        scanned = 0
        added = 0
        updated = 0
        skipped = 0
        errors = []
        active_drive_file_ids = set()

        for file_meta in drive_files:
            file_id = file_meta.get("id")
            file_name = file_meta.get("name", "unknown")
            mime_type = file_meta.get("mimeType", "")
            modified_time = file_meta.get("modifiedTime", "")
            active_drive_file_ids.add(file_id)
            scanned += 1

            try:
                # Kiểm tra tài liệu đã tồn tại trong vector_store chưa
                existing_doc = vector_store.get_document_by_drive_file_id(file_id)

                if existing_doc and not force:
                    # Nếu modifiedTime không đổi -> Bỏ qua
                    if existing_doc.get("driveModifiedTime") == modified_time:
                        logger.info(f"Skipping unchanged file '{file_name}' (Drive ID: {file_id})")
                        skipped += 1
                        continue

                # Tải và trích xuất nội dung
                logger.info(f"Downloading & extracting content from Drive: '{file_name}'")
                text_content = self.download_file_content(file_id, mime_type, file_name)

                if not text_content or not text_content.strip():
                    logger.warning(f"File '{file_name}' contains no valid text. Skipping.")
                    skipped += 1
                    continue

                category = self._infer_category(file_name)
                title = Path(file_name).stem.replace('_', ' ').replace('-', ' ').title()

                # Nếu là cập nhật -> Xóa các chunks cũ trước
                is_update = False
                if existing_doc:
                    vector_store.delete_document_by_drive_file_id(file_id)
                    is_update = True

                # Thêm tài liệu mới kèm vector chunks
                res = vector_store.add_document(
                    title=title,
                    content=text_content,
                    category=category,
                    file_name=file_name,
                    file_type=mime_type or "drive_file",
                    uploaded_by="GOOGLE_DRIVE_SYNC",
                    drive_file_id=file_id,
                    drive_modified_time=modified_time
                )

                if is_update:
                    updated += 1
                    logger.info(f"Updated document '{title}' ({res['chunksCount']} chunks).")
                else:
                    added += 1
                    logger.info(f"Added new document '{title}' ({res['chunksCount']} chunks).")

            except Exception as e:
                err_msg = f"Error processing file '{file_name}': {str(e)}"
                logger.error(err_msg)
                errors.append({"fileName": file_name, "fileId": file_id, "error": str(e)})

        # Tùy chọn: Xóa các tài liệu trên local vector_store nếu đã bị xóa khỏi Drive folder
        deleted = 0
        if prune_deleted:
            all_docs = list(vector_store.documents.values())
            for d in all_docs:
                doc_drive_id = d.get("driveFileId")
                if doc_drive_id and doc_drive_id not in active_drive_file_ids:
                    vector_store.delete_document(d["id"])
                    deleted += 1
                    logger.info(f"Pruned deleted Drive document: '{d.get('title')}'")

        duration_sec = (datetime.now() - start_time).total_seconds()
        result = {
            "status": "success" if not errors else ("partial" if (added + updated + skipped) > 0 else "failed"),
            "folderId": target_folder,
            "authMethod": self._auth_type or "UNKNOWN",
            "scanned": scanned,
            "added": added,
            "updated": updated,
            "skipped": skipped,
            "deleted": deleted,
            "errors": errors,
            "durationSeconds": round(duration_sec, 2),
            "syncedAt": datetime.now().isoformat(),
            "totalStoreDocuments": len(vector_store.documents),
            "totalStoreChunks": len(vector_store.chunks),
        }
        self._last_sync_result = result
        logger.info(f"Drive Sync finished in {duration_sec:.2f}s: +{added} new, ~{updated} updated, ={skipped} skipped, -{deleted} pruned.")
        return result

drive_sync_service = DriveSyncService()
