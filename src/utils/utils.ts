import { BaseballMeta, BaseballMetaInt } from './types';

export function dateToStr(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}.${month}.${day}. ${hour}:${minute}`;
}

export function shuffle<T>(array: T[]) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

export function getMeta(input: BaseballMeta): BaseballMetaInt {
  return {
    allowDuplicates: input.allowDuplicates ?? false,
    maxNum: input.maxNum ?? 9,
    digits: input.digits ?? 4,
    trialLimit: input.trialLimit ?? -1,
  };
}
