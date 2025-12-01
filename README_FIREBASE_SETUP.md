# Firebase 설정 가이드

## 문제 해결: "Firebase configuration is incomplete"

이 오류는 Firebase 환경 변수가 제대로 설정되지 않았을 때 발생합니다.

## 1. 로컬 개발 환경 설정

### .env 파일 생성

프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# OpenAI Configuration (선택사항)
VITE_OPENAI_API_KEY=sk-your-key
VITE_OPENAI_MODEL=gpt-4o-mini
VITE_OPENAI_API_URL=https://api.openai.com/v1/responses

# Admin Configuration (선택사항)
VITE_ADMIN_ID=your-admin-user-id
# 또는
VITE_ADMIN_EMAIL=admin@example.com
```

### Firebase 설정값 찾는 방법

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. 프로젝트 선택
3. 프로젝트 설정 (⚙️ 아이콘) → 일반 탭
4. "내 앱" 섹션에서 웹 앱 선택 (또는 새로 추가)
5. `firebaseConfig` 객체에서 필요한 값들을 복사

예시:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",           // → VITE_FIREBASE_API_KEY
  authDomain: "project.firebaseapp.com",  // → VITE_FIREBASE_AUTH_DOMAIN
  projectId: "my-project",       // → VITE_FIREBASE_PROJECT_ID
  storageBucket: "my-project.appspot.com", // → VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789", // → VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:123456789:web:abc123" // → VITE_FIREBASE_APP_ID
};
```

### 환경 변수 적용

`.env` 파일을 생성/수정한 후:

1. **개발 서버 재시작** (중요!)
   ```bash
   # 서버 중지 (Ctrl+C)
   npm run dev
   ```

2. 브라우저 콘솔(F12)에서 환경 변수가 로드되었는지 확인

## 2. Netlify 배포 환경 설정

### Netlify 대시보드에서 환경 변수 설정

1. Netlify 대시보드 → **Site settings**
2. **Environment variables** 섹션 클릭
3. **Add a variable** 버튼 클릭
4. 다음 변수들을 하나씩 추가:

   - `VITE_FIREBASE_API_KEY` = `your-firebase-api-key`
   - `VITE_FIREBASE_AUTH_DOMAIN` = `your-project.firebaseapp.com`
   - `VITE_FIREBASE_PROJECT_ID` = `your-project-id`
   - `VITE_FIREBASE_STORAGE_BUCKET` = `your-project.appspot.com`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` = `your-messaging-sender-id`
   - `VITE_FIREBASE_APP_ID` = `your-app-id`
   - `VITE_OPENAI_API_KEY` = `sk-your-key` (선택사항)
   - `VITE_ADMIN_ID` = `your-admin-id` (선택사항)

5. **Save** 클릭
6. **Deploys** 탭에서 **Trigger deploy** → **Clear cache and deploy site** 클릭

### 환경 변수 확인

배포 후 브라우저 콘솔(F12)에서 다음 메시지가 나타나야 합니다:
```
=== Firebase 환경 변수 확인 ===
VITE_FIREBASE_API_KEY: 설정됨 (AIzaSy...)
VITE_FIREBASE_AUTH_DOMAIN: your-project.firebaseapp.com
...
```

## 3. 문제 해결 체크리스트

- [ ] `.env` 파일이 프로젝트 루트에 있는가?
- [ ] 모든 `VITE_FIREBASE_*` 변수가 설정되어 있는가?
- [ ] 변수명에 오타가 없는가? (대소문자 구분)
- [ ] 개발 서버를 재시작했는가?
- [ ] Netlify에서 환경 변수를 설정하고 재배포했는가?
- [ ] 브라우저 콘솔에서 에러 메시지를 확인했는가?

## 4. 추가 도움말

문제가 계속되면:
1. 브라우저 콘솔(F12)의 전체 에러 메시지를 확인
2. `npm run build` 후 `dist` 폴더의 파일 확인
3. Netlify 빌드 로그 확인

