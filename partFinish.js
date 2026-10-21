/** One final tint pass for each physical component, after its actual geometry is
 * built and materials are isolated. Does not touch non-coating materials, damage
 * state, decals, articulation or catalogue geometry.
 */
import { factoryFinishFor, normalizePaint, PAINT_ROLE_CHANNEL } from './factoryPaint.js';

export function applyPartFinish(root, definitionId, ownerPaint=null) {
    if (!root) return root;
    const palette=normalizePaint(ownerPaint) || factoryFinishFor(definitionId);
    const replacement=new Map();
    const repaint=material=>{
        if (!material?.isMaterial) return material;
        const channel=PAINT_ROLE_CHANNEL[material.userData?.materialRole];
        if (!channel) return material;
        if (!replacement.has(material)) {
            const copy=material.clone();
            copy.color.set(palette[channel]);
            copy.userData={...material.userData,paintChannel:channel,
                finishOrigin:normalizePaint(ownerPaint)?'owner':'factory'};
            replacement.set(material,copy);
        }
        return replacement.get(material);
    };
    root.traverse(node=>{
        if (!node.isMesh || !node.material) return;
        node.material=Array.isArray(node.material)
            ? node.material.map(repaint) : repaint(node.material);
    });
    return root;
}
