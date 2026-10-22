/** Pure service-label policy. No 3D or browser imports needed by Node tests. */
export function serviceStampCount(part) {
  const repairs=part?.repairs;
  return Number.isSafeInteger(repairs)&&repairs>0?repairs:0;
}
export function serviceStampLabel(part){
  const count=serviceStampCount(part);
  if(count===0)return null;
  return count>99?'R-99+':'R-'+String(count).padStart(2,'0');
}
