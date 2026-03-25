// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    // 빌드 출력 디렉토리
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false, // 프로덕션에서는 소스맵 비활성화
        minify: 'esbuild', // 코드 압축 (esbuild가 기본값이며 더 빠름)
        // 청크 크기 경고 임계값
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                login: resolve(__dirname, 'login.html'),
                student: resolve(__dirname, 'student.html'),
                student1: resolve(__dirname, 'student1.html'),
                student2: resolve(__dirname, 'student2.html'),
                inventionSpec: resolve(__dirname, 'invention-spec.html'),
                idea: resolve(__dirname, 'idea.html'),
                reflection: resolve(__dirname, 'reflection.html'),
                teacher: resolve(__dirname, 'teacher.html'),
                drawing: resolve(__dirname, 'drawing.html'),
            },
            output: {
                // 청크 파일명 형식
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js',
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name.split('.')
                    const ext = info[info.length - 1]
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
                        return `assets/images/[name]-[hash][extname]`
                    }
                    if (/woff2?|eot|ttf|otf/i.test(ext)) {
                        return `assets/fonts/[name]-[hash][extname]`
                    }
                    return `assets/[ext]/[name]-[hash][extname]`
                },
                // 공통 의존성을 별도 청크로 분리
                manualChunks: (id) => {
                    // Firebase 관련 모듈
                    if (id.includes('firebase')) {
                        return 'firebase'
                    }
                    // PDF 관련 모듈
                    if (id.includes('pdfjs-dist') || id.includes('jspdf')) {
                        return 'pdf'
                    }
                    // Canvas 관련 모듈
                    if (id.includes('html2canvas')) {
                        return 'canvas'
                    }
                    // node_modules의 큰 라이브러리들
                    if (id.includes('node_modules')) {
                        return 'vendor'
                    }
                },
            },
        },
    },
    // 의존성 최적화
    optimizeDeps: {
        exclude: ['pdfjs-dist'],
        include: [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
        ],
    },
    // 환경 변수 접두사
    envPrefix: 'VITE_',
    // 개발 서버 설정
    server: {
        port: 5173,
        open: true,
    },
    // 미리보기 서버 설정
    preview: {
        port: 4173,
        open: true,
    },
})
