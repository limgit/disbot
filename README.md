# disbot

개인용 디스코드 봇

## How to use

1. `git clone https://github.com/limgit/disbot` 으로 레포 클론
2. `disbot` 디렉토리 내부에 아래 예시와 비슷한 내용으로 `.env` 생성
```
TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
AVAILABLE_NAMES=홍길동 아무개 김첨지
```
3. `npm install` 로 디펜던시 설치
4. `npm run build` 로 빌드
5. `npm run start` 로 실행

### Recommendation

- `pm2`를 사용해 실행하는 것도 괜찮아 보인다. 실행방법은 4스텝까지 완료한 후 `pm2 start build/index.js --name disbot`
