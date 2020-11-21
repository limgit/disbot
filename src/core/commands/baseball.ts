import { CustomCommand } from '@/core/types';
import db from '@/db';

import { shuffle, getMeta } from '@/utils/utils';
import { BaseballMeta } from '@/utils/types';

function generateAnswer(allowDup: boolean, maxNum: number, digit: number): string {
  const domain = '0123456789'.slice(0, maxNum + 1).split('');
  if (allowDup) {
    return new Array(digit).fill(null).map(() => domain[Math.floor(Math.random() * domain.length)]).join('');
  }
  return shuffle(domain).join('').slice(0, digit);
}

function metaToStr(meta: BaseballMeta) {
  const { allowDuplicates, maxNum, digits, trialLimit } = getMeta(meta);
  return `중복 허용 여부: ${allowDuplicates ? '예' : '아니오'}, 사용 가능 숫자: 0-${maxNum},`
    + ` 답 자릿수: ${digits}, 시도 제한: ${trialLimit === -1 ? '없음' : trialLimit}`;
}

const baseball: CustomCommand = {
  command: 'baseball',
  aliases: ['bb'],
  description: '숫자 야구 게임과 관련된 명령어입니다.',
  usage: [
    { description: '기본값으로 숫자 야구 게임 세션을 시작합니다. 이미 세션이 열려있는 경우 시작되지 않습니다.', args: '' },
    {
      description: '커스텀 설정으로 숫자 야구 게임 세션을 시작합니다. 이미 세션이 열려있는 경우 시작되지 않습니다.\n'
        + 'dup은 중복 허용 여부, max는 사용할 숫자의 최대값, digit는 자릿수, limit은 시도 횟수 제한(-1은 제한 없음)입니다.\n'
        + '명시되지 않은 필드는 기본값으로 처리되며, 각각의 기본값은 dup=F, max=9, digit=4, limit=-1 입니다.',
      args: 'start [dup=<T|F>] [max=<숫자>] [digit=<숫자>] [limit=<숫자>]' },
    { description: 'Mastermind 보드 게임 설정으로 숫자 야구 게임 세션을 시작합니다. dup=T, max=5, digit=4, limit=8 의 설정 값을 갖습니다. 이미 세션이 열려있는 경우 시작되지 않습니다.', args: 'mastermind' },
    { description: '현재 열려있는 숫자 야구 게임 세션을 강제로 종료합니다.', args: 'kill' },
    { description: '현재 열려있는 숫자 야구 게임 세션의 정보를 출력합니다.', args: 'info' },
  ],
  execute(message, argv) {
    const authorId = message.author.id;
    if (argv.length === 1 || argv[1] === 'start' || argv[1] === 'mastermind') {
      // Start baseball game. Game progress will be handled in @/index.ts
      (async () => {
        const res = await db.getBaseballSession(authorId);
        if (res !== false) {
          message.reply(
            '이미 진행 중인 숫자 야구 게임 세션이 있습니다.\n'
            + '새 세션을 시작하길 원하면 `!bb kill` 을 통해 세션을 종료해주세요.\n'
            + '진행 중인 세션의 정보는 `!bb info` 를 통해 확인할 수 있습니다.'
          );
          return;
        }
        const meta: BaseballMeta | string = (() => {
          let ret: BaseballMeta = {};
          if (argv.length === 1) {
            return ret;
          }
          if (argv[1] === 'mastermind') {
            ret.allowDuplicates = true;
            ret.digits = 4;
            ret.maxNum = 5;
            ret.trialLimit = 8;
            return ret;
          }
          let msg: string = '';
          for (let i = 2; i < argv.length; i++) {
            const arg = argv[i];
            if (arg.startsWith('dup=')) {
              const val = arg.slice(4);
              if (val === 'T') ret.allowDuplicates = true;
              else if (val === 'F') ret.allowDuplicates = false;
              else {
                msg = 'dup은 T 혹은 F 값만 가능합니다.';
                break;
              }
            } else if (arg.startsWith('max=')) {
              const val = Number(arg.slice(4));
              if (Number.isNaN(val)) {
                msg = 'max는 숫자만 가능합니다.';
                break;
              } else if (val > 9 || val < 0) {
                msg = 'max는 0에서 9 사이의 값만 사용할 수 있습니다.';
                break;
              } else ret.maxNum = val;
            } else if (arg.startsWith('digit=')) {
              const val = Number(arg.slice(6));
              if (Number.isNaN(val)) {
                msg = 'digit은 숫자만 가능합니다.';
                break;
              } else if (val < 1) {
                msg = 'digit은 1 이상이어야 합니다.';
                break;
              } else ret.digits = val;
            } else if (arg.startsWith('limit=')) {
              const val = Number(arg.slice(6));
              if (Number.isNaN(val)) {
                msg = 'limit은 숫자만 가능합니다.';
                break;
              } else if (val < -1 || val === 0) {
                msg = 'limit은 -1 이거나 1 이상이어야 합니다.';
                break;
              } else ret.trialLimit = val;
            }
          }
          // maxNum / digit validation
          const refined = getMeta(ret);
          if (!refined.allowDuplicates && refined.digits > refined.maxNum) {
            msg = `중복이 허용되지 않는다면, max가 (digit - 1) 이상이어야 합니다. 현재 digit=${refined.digits}, max=${refined.maxNum}`;
          }
          if (msg !== '') return msg;
          return ret;
        })();
        if (typeof meta === 'string') {
          message.reply(`숫자 야구 게임을 시작할 수 없습니다.\n${meta}`);
          return;
        }
        message.reply(
          '숫자 야구 게임을 시작합니다.\n'
          + `설정 = ${metaToStr(meta)}`
        );
        const { allowDuplicates, digits, maxNum } = getMeta(meta);
        const answer = generateAnswer(allowDuplicates, maxNum, digits);
        await db.createBaseballSession(authorId, answer, meta);
        message.reply(
          '설정에 따라 정답 숫자를 결정했습니다! 숫자를 입력해 게임을 시작해주세요.\n'
          + '주의: 답이 되는 숫자는 0으로 시작할 수 있습니다.'
        );
      })().catch((err) => {
        message.reply(`에러가 발생했습니다: ${JSON.stringify(err)}`);
      });
      return;
    }

    if (argv[1] === 'kill') {
      message.reply('진행 중인 숫자 야구 세션을 종료합니다.');
      db.dropBaseballSession(authorId).then(() => {
        message.reply('숫자 야구 세션이 종료되었습니다.');
      }).catch((err) => {
        message.reply(`에러가 발생했습니다: ${JSON.stringify(err)}`);
      });
      return;
    }
    
    if (argv[1] === 'info') {
      db.getBaseballSession(authorId).then((res) => {
        if (res === false) {
          message.reply('현재 진행 중인 숫자 야구 세션이 없습니다.');
        } else {
          const log = res.log;
          message.reply(
            '현재 진행 중인 숫자 야구 세션에 대한 정보입니다.\n'
            + `설정 = ${metaToStr(res.meta)}\n`
            + `시도 횟수: ${res.trial}\n`
            + `시도 로그:\n${log.length === 0 ? '없음' : log.map((e, i) => `${i + 1}번째 시도 - ${e}`).join('\n')}`
          );
        }
      }).catch((err) => {
        message.reply(`에러가 발생했습니다: ${JSON.stringify(err)}`);
      });
      return;
    }

    message.reply(`알려지지 않은 인자입니다: ${argv[1]}. \`!help bb\`를 통해 자세한 사용법을 확인할 수 있습니다.`);
  }
}
export default baseball;
