import { CustomCommand } from '@/core/types';

const money: CustomCommand = {
  command: 'money',
  description: '돈 정산을 해줘요!',
  usage: [
    { description: '최근 20개의 채무 이력을 보여줍니다', args: 'list' },
    { description: '현재 채무 상태를 보여줍니다', args: 'status' },
    { description: '채무 정보를 추가합니다', args: 'debt <금액(원)> <채권자> <채무자>' },
    { description: '더치페이 정보를 추가합니다', args: 'dutch <총 금액(원)> <더치페이 참여자 목록(공백 구분)>'},
    { description: '정산 정보를 추가합니다', args: 'clear <금액(원)> <채권자> <채무자>' },
  ],
  execute(message, argv) {
    if (argv.length === 1) {
      return message.reply('money 명령어는 최소 하나의 인자가 필요합니다. `!help money`를 통해 자세한 사용법을 확인할 수 있습니다.');
    }
    message.reply('아직 구현 중입니다...');
  }
}
export default money;
