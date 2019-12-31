import { CustomCommand } from '@/core/types';

const dice: CustomCommand = {
  command: 'dice',
  description: '굴려굴려 주사위',
  usage: '<count>d<side>',
  execute(message, argv) {
    const [count, side] = argv[1].split('d').map((i) => Number(i));

    const result = new Array(count).fill('_').map(() => Math.floor(Math.random() * side) + 1);
    const msg = [];
    msg.push(`합: ${result.reduce((acc, curr) => acc + curr, 0)}`);
    msg.push(`주사위 세부 결과: ${result.join(', ')}`);
    message.reply(msg);
  }
}
export default dice;
