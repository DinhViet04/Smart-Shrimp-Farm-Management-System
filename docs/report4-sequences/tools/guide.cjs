module.exports=({fs,path,out,docs,features})=>{
 const primary=docs.filter(d=>d.feature),byId=new Map(docs.map(d=>[d.id,d]));
 const closure=id=>{const seen=new Set(),visit=key=>{if(seen.has(key))return;seen.add(key);byId.get(key).references.forEach(visit);};visit(id);return [...seen].map(k=>byId.get(k));};
 const steps=d=>[...new Set(d.numbers.filter(n=>n.kind==='ref'||n.kind==='message'&&n.arrow==='->').map(n=>n.label))];
 const summary=d=>{
  if(!d.participants.S){
   if(/Dashboard/.test(d.title))return 'Người dùng mở dashboard; hệ thống tải các phần dữ liệu được chỉ ra trong ref và hiển thị kết quả trong phạm vi quyền truy cập.';
   if(d.references.length&&d.numbers.some(n=>n.label==='Choose an action'))return 'Người dùng chọn một thao tác; mỗi nhánh dẫn đến luồng chi tiết tương ứng và kết quả của thao tác đó.';
  }
  const actions=steps(d);return actions.length?'Các bước chính và tùy chọn, theo điều kiện trên sơ đồ: '+actions.slice(0,8).join(' → ')+'.':'Xem các tương tác và điều kiện trên sơ đồ.';
 };
 const assumptions=d=>[...new Set(closure(d.id).flatMap(x=>x.assumptions))];
 const evidence=d=>[...new Map(closure(d.id).flatMap(x=>x.sources).map(s=>[s.file+'#'+s.symbol,s])).values()];
 const mdLink=s=>`[${s.file}:${s.line}](../../${s.file}#L${s.line}) — \`${s.symbol}\``;
 const counts=Object.fromEntries(['Existing workflow','Existing + proposed extension','Proposed design'].map(s=>[s,primary.filter(d=>d.status===s).length]));
 const text=`# Sequence diagrams cho Report 4

Bộ tài liệu gồm **57 FE** thuộc 16 nhóm chức năng trong mục 3 của **Report4_Software Design Document (1).docx**, cùng **${docs.length-57} sơ đồ chi tiết/hỗ trợ**. Sơ đồ thể hiện thiết kế mục tiêu của Report 4 theo lựa chọn của người dùng. Phần đã có trong code được dùng làm căn cứ; phần chưa có được đánh dấu **Proposed**. Không chỉnh sửa mã nguồn ứng dụng hoặc file Word gốc.

Report 4 dùng số mục như **3.1.2.1**, không đặt mã FE trực tiếp. Mã **FE-01…FE-57** được gán theo đúng thứ tự 57 tiêu đề sequence diagram trong tài liệu, với số mục gốc giữ lại trong bảng bên dưới. Không sử dụng các comment FE cũ trong schema làm chỉ mục.

## Mở và sử dụng

- Mở [danh mục trực quan](index.html) để tìm theo FE hoặc tên chức năng, xem SVG và mở mã PlantUML.
- Mỗi FE có file độc lập **FE-xx.puml**; ảnh vector tương ứng là **svg/FE-xx.svg**.
- FE có nhiều thao tác dùng sơ đồ tổng quan ngắn và **ref** đến các luồng chi tiết. Toàn bộ nội dung của các ref đều được cung cấp.
- Nhãn thông điệp bằng tiếng Anh đơn giản. **SSFM Interface** đại diện giao diện người dùng chung, không tách Web/Mobile.

## Cách phân biệt thiết kế và hiện trạng

| Nhãn | Ý nghĩa | Số FE |
|---|---|---|
| Existing workflow | Luồng nghiệp vụ có căn cứ mã nguồn hiện tại | ${counts['Existing workflow']} |
| Existing + proposed extension | Có luồng hiện tại nhưng sơ đồ hoặc ref chứa phần mở rộng mục tiêu | ${counts['Existing + proposed extension']} |
| Proposed design | Chưa có đầy đủ luồng hiện tại; đây là thiết kế đề xuất | ${counts['Proposed design']} |

Caption và ghi chú ngắn chỉ rõ phần đề xuất. Nhãn trạng thái của sơ đồ tổng quan cũng tính đến các ref mà nó sử dụng. Tên lớp mới như DailyNotesService, FeedingRecommendationService, Report Exporter và các kênh Expo/FCM/APNs được ghi là proposed khi chưa có mã tương ứng. Existing workflow không có nghĩa là đã kiểm thử end-to-end hoặc đã triển khai trên server.

## Các quyết định về phạm vi

Đây là sequence ở mức thiết kế nghiệp vụ, tập trung vào người dùng và hệ thống. Controller được mô hình hóa như **biên xử lý request của endpoint**, bao gồm kết quả guard/validation do NestJS thực hiện trước handler; không khẳng định controller gọi guard trực tiếp. Chi tiết này nằm trong REQUEST-CHECKS và PUBLIC-CHECKS.

Các lifeline được sắp từ trái sang phải: **Actor → UI → Controller → Service → Supporting Service → PrismaService → Database → External Service**. Chỉ giữ thành phần thực sự tham gia; không thêm lifeline trống để đủ mẫu. Database PostgreSQL có lifeline riêng sau PrismaService, với call và reply nối đúng caller. Với kho tri thức Python, ChromaDB được thể hiện là database dự kiến; không thêm PrismaService vào luồng Python không dùng Prisma. External Service nằm bên phải database khi cùng xuất hiện. Đây là thứ tự bố trí lifeline, không thay đổi thứ tự gọi nghiệp vụ.

Không vẽ driver hoặc SQL. Các phép tính nội bộ được thể hiện qua điều kiện, kết quả hoặc ghi chú ngắn; không tạo self-call cho mỗi phép gán. Một số nhóm đọc/lưu liên quan được gộp, vẫn giữ điểm kiểm tra điều kiện và trách nhiệm của thành phần.

Report mô tả ChromaDB và Expo/FCM/APNs là kiến trúc dự kiến. Code hiện tại dùng kho vector JSON phía Python và không có push hệ điều hành. Các bước chuyển sang ChromaDB, đồng bộ kho tri thức, live client thống nhất và push được đánh dấu đề xuất. Không đưa Caddy, Cloudflare, CI/CD hoặc Docker vào từng luồng nghiệp vụ chỉ vì chúng có trong sơ đồ kiến trúc.

Thuật toán khẩu phần thích ứng, cơ chế thu hồi access token tức thì, trường dữ liệu ghi chú độc lập và chính sách giải quyết cảnh báo chưa được Report 4 đặc tả đầy đủ. Sơ đồ chỉ đề xuất trách nhiệm và thứ tự tương tác, không bịa công thức, ngưỡng an toàn, bảng database hoặc API đã triển khai. Danh mục sản phẩm dùng liên kết Inventory–Supplier; báo cáo hiệu quả lấy vụ nuôi được chọn; thống kê quản trị dùng số liệu nghiệp vụ hiện có.

## Quy ước UML và đánh số

- Call đồng bộ: đường liền, đầu tam giác kín. Reply: đường đứt, đầu mở. Sự kiện không chờ kết quả: đường liền, đầu mở.
- Activation bắt đầu khi thành phần xử lý lời gọi và kết thúc ở reply hoặc ngay sau fragment chứa các reply thay thế. Caller có thể giữ activation trong khi chờ. Lifeline vẫn tiếp tục khi activation kết thúc.
- Các nhánh từ chối chỉ trả lỗi cho caller thực tế. Phần việc chỉ dành cho thành công nằm trong toán hạng else. Sau khi chọn kết quả, các reply chung chỉ truyền kết quả/lỗi về giao diện; chúng không chạy lại bước thành công.
- Hàm JavaScript async không tự động là thông điệp UML async. Helper nền được gọi đồng bộ và trả về việc đã khởi động; phần tiếp tục nằm trong sơ đồ hỗ trợ, không áp đặt thứ tự hoàn thành so với HTTP response.
- Main flow dùng 1, 2, 3… (kể cả ref). Nhánh tại bước 4 là 4.1 hoặc 4.2; thông điệp trong nhánh là 4.1.1, 4.1.2…; nhánh không tăng số main flow. opt/loop và nhánh lồng nhau mở rộng cùng quy ước. Số trong loop là số bước tài liệu, dùng lại mỗi vòng.
- Điều kiện được PlantUML tự đặt trong ngoặc vuông khi render. Không gõ thêm cặp ngoặc bên ngoài chuỗi có dấu cách để tránh bị hiểu là hyperlink Creole. Phần số ở đầu guard là chú giải tài liệu; guard và fragment vẫn quyết định luồng.
- par chỉ dùng cho cặp overview/incidents của dashboard manager, có Promise.all trong source. Các panel khác có thể tải độc lập; sơ đồ chọn một thứ tự hợp lệ cho việc trình bày, không khẳng định thời gian thực thi.

Tham khảo ký hiệu: [OMG UML 2.5.1](https://www.omg.org/spec/UML/2.5.1), [PlantUML sequence syntax](https://plantuml.com/sequence-diagram).

## Chỉ mục 57 FE

| FE | Mục Report 4 | Chức năng | Trạng thái | Tệp |
|---|---|---|---|---|
${primary.map(d=>`| ${d.id} | ${d.feature.section} | ${d.title} | ${d.status} | [PlantUML](${d.id}.puml) · [SVG](svg/${d.id}.svg) |`).join('\n')}

## Giải thích và căn cứ từng FE

${primary.map(d=>`### ${d.id} — ${d.title}\n\n${summary(d)}\n\n**Actor:** ${d.actor}. **Trạng thái:** ${d.status}.\n\n${d.references.length?'**Luồng chi tiết:** '+d.references.map(id=>'['+id+']('+id+'.puml)').join(', ')+'.\n\n':''}**Thành phần và trách nhiệm:**\n\n${[...new Map(closure(d.id).flatMap(x=>Object.values(x.participants)).map(p=>[p.name,p])).values()].map(p=>'- **'+p.name+(p.proposed?' (proposed)':'')+'**: '+(p.responsibility||'Thực hiện tương tác đã ghi trên lifeline.')).join('\n')}\n\n${assumptions(d).length?'**Giả định, phần thiếu hoặc khác hiện trạng:**\n\n'+assumptions(d).map(a=>'- '+a).join('\n')+'\n\n':''}**Căn cứ mã nguồn:**\n\n${evidence(d).map(s=>'- '+mdLink(s)).join('\n')}\n`).join('\n')}
## Dựng lại

<code>node docs/report4-sequences/tools/generate.cjs</code>

<code>java -jar &lt;plantuml.jar&gt; -charset UTF-8 -tsvg -o svg "docs/report4-sequences/*.puml"</code>

<code>node docs/report4-sequences/tools/validate.cjs --rendered</code>

manifest.json lưu quan hệ FE–mục báo cáo–sơ đồ–nguồn–ref và số thông điệp. VALIDATION.md ghi kết quả kiểm tra. Không chạy migration, sửa dependency hoặc thay đổi logic ứng dụng để vẽ sơ đồ.
`;
 fs.writeFileSync(path.join(out,'README.md'),text);
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const card=(d,main=false)=>`<article data-search="${esc([d.id,d.title,d.feature?.section||''].join(' ').toLowerCase())}"><header><div><span class="id">${esc(d.id)}</span> <span class="badge">${esc(d.status)}</span>${main?'<small>Report 4 · '+esc(d.feature.section)+'</small>':''}<h2>${esc(d.title)}</h2></div><nav><a href="${d.id}.puml">PlantUML</a><a href="svg/${d.id}.svg" target="_blank">SVG</a></nav></header>${main?'<p>'+esc(summary(d))+'</p>':''}<details><summary>Xem sơ đồ</summary><a href="svg/${d.id}.svg" target="_blank"><img loading="lazy" src="svg/${d.id}.svg" alt="${esc(d.title)}"></a></details>${d.references.length?'<footer>Luồng liên quan: '+d.references.map(id=>'<a href="#'+id+'">'+id+'</a>').join(' · ')+'</footer>':''}</article>`;
 const html=`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SSFM Report 4 sequence diagrams</title><style>body{font:16px/1.55 Arial,sans-serif;color:#18202a;background:#f4f6f8;max-width:1440px;margin:0 auto;padding:28px}h1{font-size:30px;margin:0 0 10px}h2{font-size:18px;margin:10px 0}p{max-width:1000px}input{font:inherit;padding:12px;border:1px solid #b9c3cd;border-radius:6px;width:min(95%,700px);margin:18px 0}article{background:white;border:1px solid #d5dce3;border-radius:8px;margin:14px 0;padding:20px}header{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}nav{display:flex;gap:14px;align-items:center}a{color:#0756a0;text-decoration:none}a:hover{text-decoration:underline}.id{font-weight:bold}.badge{display:inline-block;font-size:12px;padding:3px 8px;border:1px solid #b5bdc5;border-radius:12px;margin-left:8px}small{display:block;margin-top:6px;color:#59636d}summary{cursor:pointer;color:#0756a0;padding:8px 0}img{max-width:100%;height:auto;background:white}footer{margin-top:14px;font-size:14px}section>h2{font-size:24px;margin-top:36px}.hidden{display:none}</style><h1>SSFM · Report 4 Sequence Diagrams</h1><p>57 FE theo đúng thứ tự Report 4. Không tách Web/Mobile. Phần chưa có trong code được đánh dấu <strong>Proposed</strong>; đây là thiết kế mục tiêu theo lựa chọn của bạn.</p><p><a href="README.md">Giải thích và căn cứ mã nguồn</a> · <a href="VALIDATION.md">Kết quả kiểm tra</a> · <a href="manifest.json">Chỉ mục nguồn</a></p><input id="search" placeholder="Tìm FE, tên chức năng hoặc mục Report 4" aria-label="Tìm sơ đồ"><section><h2>57 chức năng trong Report 4</h2>${primary.map(d=>'<div id="'+d.id+'">'+card(d,true)+'</div>').join('')}</section><section><h2>Luồng chi tiết và hỗ trợ</h2>${docs.filter(d=>!d.feature).map(d=>'<div id="'+d.id+'">'+card(d)+'</div>').join('')}</section><script>document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('article').forEach(a=>a.parentElement.classList.toggle('hidden',!a.dataset.search.includes(q)));});addEventListener('hashchange',()=>{const el=document.getElementById(location.hash.slice(1));if(el){el.classList.remove('hidden');el.querySelector('details')?.setAttribute('open','');}});</script></html>`;
 fs.writeFileSync(path.join(out,'index.html'),html);
};
