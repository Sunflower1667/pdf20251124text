# Firebase 문제 해결 가이드

## 🔴 "Firebase configuration is incomplete" 오류 해결

### 1단계: .env 파일 확인

프로젝트 루트에 `.env` 파일이 있어야 합니다.

**파일 위치 확인:**
```
프로젝트루트/
  ├── .env          ← 여기에 있어야 함!
  ├── package.json
  ├── vite.config.js
  └── src/
```

**파일 내용 예시:**
```env
VITE_FIREBASE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz
VITE_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=my-project-id
VITE_FIREBASE_STORAGE_BUCKET=my-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

### 2단계: 중요한 체크리스트

- [ ] `.env` 파일이 프로젝트 **루트 디렉토리**에 있는가?
- [ ] 모든 변수명이 `VITE_`로 시작하는가?
- [ ] 변수명에 오타가 없는가? (대소문자 정확히)
- [ ] 값에 따옴표가 없는가? (`"` 또는 `'` 없이)
- [ ] 각 줄 끝에 공백이나 특수문자가 없는가?
- [ ] `#` 주석이 변수와 같은 줄에 없는가?

**❌ 잘못된 예:**
```env
VITE_FIREBASE_API_KEY="AIzaSy..."  # 따옴표 있음
VITE_FIREBASE_API_KEY = AIzaSy...  # 공백 있음
firebase_api_key=AIzaSy...          # VITE_ 접두사 없음
```

**✅ 올바른 예:**
```env
VITE_FIREBASE_API_KEY=AIzaSy...
```

### 3단계: 개발 서버 재시작

`.env` 파일을 수정했다면 **반드시** 서버를 재시작하세요:

```bash
# 1. 서버 중지 (Ctrl+C)
# 2. 서버 재시작
npm run dev
```

### 4단계: 브라우저 콘솔 확인

1. 브라우저에서 F12 키 누르기
2. Console 탭 클릭
3. 다음 메시지 확인:

```
=== Firebase 환경 변수 로드 확인 ===
import.meta.env 모드: development
환경 변수 상태:
  VITE_FIREBASE_API_KEY: ✓ 설정됨 (AIzaSy...)
  VITE_FIREBASE_AUTH_DOMAIN: my-project.firebaseapp.com
  ...
```

**모든 변수가 "❌ 없음"으로 표시되면:**
- `.env` 파일이 제대로 로드되지 않음
- 서버를 재시작했는지 확인
- `.env` 파일 위치 확인

### 5단계: Firebase 설정값 찾기

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. ⚙️ **프로젝트 설정** 클릭
4. **일반** 탭에서 아래로 스크롤
5. **내 앱** 섹션에서 웹 앱 선택 (없으면 추가)
6. `firebaseConfig` 객체 복사:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",              // → VITE_FIREBASE_API_KEY
  authDomain: "xxx.firebaseapp.com", // → VITE_FIREBASE_AUTH_DOMAIN
  projectId: "xxx",                  // → VITE_FIREBASE_PROJECT_ID
  storageBucket: "xxx.appspot.com",  // → VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789",    // → VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:123:web:abc"             // → VITE_FIREBASE_APP_ID
};
```

### 6단계: Netlify 배포 시

Netlify 대시보드에서:

1. **Site settings** → **Environment variables**
2. 다음 변수들을 **하나씩** 추가:
   - Key: `VITE_FIREBASE_API_KEY`, Value: `AIzaSy...`
   - Key: `VITE_FIREBASE_AUTH_DOMAIN`, Value: `xxx.firebaseapp.com`
   - Key: `VITE_FIREBASE_PROJECT_ID`, Value: `xxx`
   - Key: `VITE_FIREBASE_STORAGE_BUCKET`, Value: `xxx.appspot.com`
   - Key: `VITE_FIREBASE_MESSAGING_SENDER_ID`, Value: `123456789`
   - Key: `VITE_FIREBASE_APP_ID`, Value: `1:123:web:abc`
3. **Save** 클릭
4. **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

### 7단계: 여전히 안 되면

**로컬에서 테스트:**
```bash
# 1. node_modules 재설치
rm -rf node_modules package-lock.json
npm install

# 2. .env 파일 확인
cat .env  # 또는 Windows: type .env

# 3. 빌드 테스트
npm run build

# 4. 개발 서버 시작
npm run dev
```

**브라우저 콘솔에서 확인:**
```javascript
// 콘솔에 직접 입력
console.log(import.meta.env.VITE_FIREBASE_API_KEY)
// 값이 나오면 정상, undefined면 환경 변수 문제
```

## 🆘 긴급 해결책 (임시)

만약 계속 안 되면, 임시로 `src/firebaseConfig.js` 파일에 직접 값을 넣을 수 있습니다:

```javascript
const firebaseConfig = {
  apiKey: "여기에_실제_API_KEY",
  authDomain: "여기에_실제_AUTH_DOMAIN",
  // ... 나머지도
}
```

⚠️ **주의:** 이 방법은 보안상 좋지 않으므로 개발용으로만 사용하고, Git에 커밋하지 마세요!

