/** Fixed-step projectile travel. Collision authority remains with scene's
 * actual moving-mesh/world raycast over the complete swept segment.
 */
export function rocketFlightStep({position,direction,speed=32,life=4},dt) {
    if(!Number.isFinite(dt)||dt<=0) return null;
    const step=Math.min(dt,Math.max(0,life));
    if(step<=0) return null;
    const length=Math.hypot(direction.x,direction.y,direction.z)||1;
    const scale=speed*step/length;
    const end={x:position.x+direction.x*scale,y:position.y+direction.y*scale,z:position.z+direction.z*scale};
    return {start:{...position},end,distance:speed*step,lifeAfter:Math.max(0,life-step)};
}
