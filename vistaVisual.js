/** VISTA / old farm-vehicle observation cab, not an armored head. */
import * as THREE from 'three';
import {groupAt,block,chamferBlock,pitchedBlock,beamBetween,
    mountCollar,finishCommandVisual} from './commandVisualKit.js';
export function buildVistaVisual(fixture){
    const root=new THREE.Group();root.name='fit-fixture:cab-utility';
    const tub=groupAt(root,'VISTA / LOWER OPERATOR TUB');
    chamferBlock(tub,'yellow waist sill',[0,-.397,-.020],[1.00,.247,.93],'ochre',.065);
    block(tub,'dark raised operator interior',[0,.015,.09],[.72,.755,.65],'heat');
    const windows=groupAt(root,'VISTA / OPEN GREENHOUSE');
    // One continuous sloping front window, not two humanoid eye panels.
    pitchedBlock(windows,'single high windscreen',[0,.061,-.357],
        [.717,.747,.027],-.245,'glass');
    for(const side of [-1,1]){
        const label=side<0?'left':'right';
        pitchedBlock(windows,label+' mustard windscreen pillar',[side*.411,.067,-.354],
            [.116,.860,.096],-.245,'ochre');
        block(windows,label+' broad tall side glazing',[side*.437,.088,.101],
            [.024,.650,.518],'glass');
        beamBetween(windows,label+' dark rear roof post',
            [side*.452,-.297,.393],[side*.452,.452,.393],.062,.072,'iron');
        block(windows,label+' side bottom yellow rail',[side*.441,-.277,.16],
            [.09,.082,.53],'ochre');
    }
    pitchedBlock(windows,'low forward glazing sill',[0,-.284,-.460],
        [.79,.093,.10],-.245,'ochre');
    const equipment=groupAt(root,'VISTA / ROOF AND SERVICES');
    block(equipment,'flat overhanging teal roof',[0,.480,-.006],[1.06,.112,1.025],'teal');
    block(equipment,'small rooftop radio case',[-.08,.548,.230],[.285,.064,.194],'iron');
    block(equipment,'rear orange utility equipment box',[.352,-.240,.447],
        [.233,.260,.196],'rust');
    block(equipment,'utility box dark attachment lug',[.349,-.240,.330],
        [.164,.144,.068],'iron');
    mountCollar(root,fixture.envelope[1],.165);
    return finishCommandVisual(root,fixture,'tall observation greenhouse');
}
