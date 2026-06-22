export enum MemberLevel {
  NORMAL = 'normal',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

export const MemberDiscounts: Record<MemberLevel, number> = {
  [MemberLevel.NORMAL]: 1.0,
  [MemberLevel.SILVER]: 0.95,
  [MemberLevel.GOLD]: 0.9,
  [MemberLevel.PLATINUM]: 0.85,
}

export const MemberLevelNames: Record<MemberLevel, string> = {
  [MemberLevel.NORMAL]: '普通会员',
  [MemberLevel.SILVER]: '白银会员',
  [MemberLevel.GOLD]: '黄金会员',
  [MemberLevel.PLATINUM]: '铂金会员',
}
