/*
 * 파워 앤 플로우 (Power & Flow) 설정
 *
 * firebaseDatabaseURL 을 비워 두면 "데모 모드"로 동작합니다.
 *   - 결과가 이 브라우저(localStorage)에만 저장되고, 샘플 참가자 8명이 자동으로 채워집니다.
 *   - 같은 PC의 다른 탭끼리만 실시간으로 동기화됩니다.
 *
 * 수강생들과 실제로 결과를 실시간 공유하려면 (무료):
 *   1) https://console.firebase.google.com 에서 프로젝트 생성
 *   2) Build → Realtime Database → 데이터베이스 만들기
 *   3) 규칙(Rules) 탭을 README.md 의 "Firebase 규칙" 으로 교체 후 게시
 *   4) 아래 firebaseDatabaseURL 에 데이터베이스 주소를 붙여 넣고 커밋
 *      예) "https://my-project-default-rtdb.asia-southeast1.firebasedatabase.app"
 */
window.GPE_CONFIG = {
  firebaseDatabaseURL: "",
  pollSeconds: 4
};
