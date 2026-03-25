// vite.config.js
import { resolve } from 'path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const envFromFiles = loadEnv(mode, process.cwd(), 'VITE_')
  const bucket =
    (process.env.VITE_FIREBASE_STORAGE_BUCKET || envFromFiles.VITE_FIREBASE_STORAGE_BUCKET || '').trim()

  if (!bucket) {
    console.warn(
      '\n[vite] VITE_FIREBASE_STORAGE_BUCKET 이(가) 빌드 시점에 비어 있습니다.\n' +
        '  · Netlify: Site configuration → Environment variables → 이름은 정확히 VITE_FIREBASE_STORAGE_BUCKET\n' +
        '    (Scopes에서 **Production**뿐 아니라 쓰는 **Deploy previews / Branch deploys**에도 같은 변수를 넣었는지 확인)\n' +
        '  · 저장 후 **Deploys → Trigger deploy → Clear cache and deploy** 로 다시 빌드\n' +
        '  · 로컬: .env 저장 후 터미널에서 dev 서버 종료 → npm run dev 또는 npm run build\n'
    )
  } else {
    console.log('[vite] VITE_FIREBASE_STORAGE_BUCKET ✓ 빌드에 포함됩니다.')
  }

  return {
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
  }
})
