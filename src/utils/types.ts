export interface BaseballMetaInt {
  allowDuplicates: boolean,
  maxNum: number,
  digits: number,
  trialLimit: number,
}
export type BaseballMeta = Partial<BaseballMetaInt>;
