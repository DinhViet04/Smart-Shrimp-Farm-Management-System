import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Rule của React Compiler: báo mọi setState đồng bộ trong effect, kể cả mẫu
      // "tải dữ liệu khi mở màn hình" (setLoading(true) rồi gọi API) dùng khắp dự án.
      // Mẫu này chạy đúng (chỉ thêm 1 lần render); viết lại toàn bộ rủi ro hơn lợi ích.
      'react-hooks/set-state-in-effect': 'off',
      // Quy ước: tham số / biến bắt đầu bằng `_` là cố ý không dùng
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
])
