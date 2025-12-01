# Firebase 설정 가이드

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 후 생성

## 2. 웹 앱 추가

1. Firebase 프로젝트 대시보드에서 "웹" 아이콘 클릭
2. 앱 닉네임 입력 (예: 발명 아이디어 창출 시스템)
3. "앱 등록" 클릭
4. Firebase 설정 정보 복사

## 3. Authentication 설정

1. 좌측 메뉴에서 "Authentication" 선택
2. "시작하기" 클릭
3. "Sign-in method" 탭 선택
4. "Google" 선택 후 활성화
5. 지원 이메일 선택 (프로젝트 이메일)
6. "저장" 클릭

## 4. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고, Firebase 설정 정보를 입력하세요:

```env
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## 5. Firebase SDK 설치

터미널에서 다음 명령어 실행:

```bash
npm install firebase
```

## 6. 확인 사항

- Google 로그인이 활성화되어 있는지 확인
- 환경 변수가 올바르게 설정되었는지 확인
- Firebase 프로젝트에서 웹 앱이 등록되었는지 확인

