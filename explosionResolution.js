/** Blast falloff is spatial and finite; exposed modules and actual cover are
 * resolved by a scene raycast. This function cannot award unobserved hits.
 */
export function blastDamage(distance,radius,nominal) {
  if(!Number.isFinite(distance)||!Number.isFinite(radius)||!Number.isFinite(nominal)||radius<=0)return 0;
  const x=Math.max(0,Math.min(1,distance/radius));
  return Math.max(0,Math.round(nominal*(1-x*x)*100)/100);
}
