import { CustomCommand } from '@/core/types';

const select: CustomCommand = {
  command: 'select',
  description: '결정 장애가 온다면 봇에게 선택을 맡기자',
  usage: '<공백으로 구분된 아이템 리스트>',
  execute(message, argv) {
    message.reply(argv[Math.floor(Math.random() * (argv.length - 1)) + 1]);
  }
}
export default select;
