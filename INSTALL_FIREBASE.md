# Firebase 설치 가이드

## 문제
`Failed to resolve import "firebase/auth"` 오류가 발생합니다.

## 원인
Firebase 패키지가 설치되지 않았습니다.

## 해결 방법

### 방법 1: CMD 사용 (권장)

1. Windows 키 + R 누르기
2. `cmd` 입력하고 Enter
3. 다음 명령어 실행:

```bash
cd C:\Users\tetb2\Documents\GitHub\pdf20251124text
npm install firebase
```

### 방법 2: PowerShell 실행 정책 변경

1. Windows 키 + X 누르기
2. "Windows PowerShell (관리자)" 선택
3. 다음 명령어 실행:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

4. Y 입력하고 Enter
5. 프로젝트 폴더로 이동:

```powershell
cd C:\Users\tetb2\Documents\GitHub\pdf20251124text
npm install firebase
```

### 방법 3: Visual Studio Code 터미널 사용

1. VS Code에서 터미널 열기 (Ctrl + `)
2. 터미널에서 다음 명령어 실행:

```bash
npm install firebase
```

## 설치 확인

설치가 완료되면 다음 명령어로 확인할 수 있습니다:

```bash
npm list firebase
```

또는 `node_modules/firebase` 폴더가 생성되었는지 확인하세요.

## 설치 후

Firebase 설치 후에는 개발 서버를 재시작하세요:

```bash
npm run dev
```

