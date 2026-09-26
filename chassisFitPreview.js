/** k.3a.3: isolated Chassis Lab fit controller. NOT the production garage.
 * One engineered Yardwalker model, optional real-length preview guide brackets,
 * and a one-tap comparison against the previous simple envelope maquette.
 */
import * as THREE from 'three';
import { standardFitFixtures } from './chassisFitFixtures.js';
import { analyzeFit } from './chassisFitValidation.js?v=k3a3';
import { buildFitFixture, disposeFitGeometry } from './chassisFitVisuals.js?v=k3a3';
import { buildYardwalkerGuideVisuals } from './yardwalkerVisual.js';

export function createFitPreviewController({scene,onVisualChange=()=>{}}){
    const switchers=[...document.querySelectorAll('[data-assembly-mode]')];
    const mobilityModels=[...document.querySelectorAll('[data-mobility-model]')];
    const guidesToggle=document.getElementById('show-mobility-guides');
    const mobilityStudy=document.getElementById('mobility-study');
    const visibility=document.getElementById('fixture-visibility');
    const summary=document.getElementById('fit-summary');
    const results=document.getElementById('fit-results');
    const selected=document.getElementById('fit-selected');
    const fixtures=standardFitFixtures();
    const enabled=new Map(fixtures.map(f=>[f.id,true]));
    let frame=null,analysis=null,visual=new THREE.Group(),guides=new THREE.Group();
    let mode='bare',mobilityModel='engineered',focus=null;
    visual.name='installed-fit-components';guides.name='frame-side-unrated-guide-brackets';
    scene.add(visual);scene.add(guides);

    for(const fixture of fixtures){
        const label=document.createElement('label');label.className='fixture-toggle';
        const input=document.createElement('input');input.type='checkbox';input.checked=true;
        input.setAttribute('aria-label',`Show ${fixture.name}`);
        const name=document.createElement('span');name.textContent=fixture.name;
        const metric=document.createElement('small');metric.textContent=`${fixture.massKg} kg`;
        label.append(input,name,metric);visibility.append(label);
        input.addEventListener('change',()=>{
            enabled.set(fixture.id,input.checked);
            applyVisibility();
        });
    }
    function guideRequested(){return mobilityModel==='engineered'&&guidesToggle.checked;}
    function applyVisibility(){
        for(const child of visual.children){
            const active=enabled.get(child.userData.fitFixtureId)!==false;
            child.visible=active;
            child.userData.outline.visible=active&&child.userData.fitFixtureId===focus;
        }
        guides.visible=mode==='assembled'&&guideRequested()&&
            enabled.get('legs-yard')!==false&&!!analysis?.guidePlan?.ok;
        onVisualChange('visibility');
    }
    function clearVisual(){
        for(const child of [...visual.children]){
            visual.remove(child);disposeFitGeometry(child);
        }
        for(const child of [...guides.children]){
            guides.remove(child);child.traverse(o=>o.geometry?.dispose());
        }
    }
    function rebuild(){
        clearVisual();
        if(!frame)return;
        analysis=analyzeFit(frame,fixtures,{mobilityGuides:guideRequested()});
        for(const item of analysis.components){
            if(!item.pose)continue;
            const model=buildFitFixture(item.fixture,{mobilityModel});
            const x=new THREE.Vector3(...item.pose.rotation[0]);
            const y=new THREE.Vector3(...item.pose.rotation[1]);
            const z=new THREE.Vector3(...item.pose.rotation[2]);
            model.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
            model.position.set(...item.pose.position);
            visual.add(model);
        }
        if(guideRequested()&&analysis.guidePlan?.ok)
            guides.add(buildYardwalkerGuideVisuals(analysis.guidePlan));
        applyVisibility();renderResults();onVisualChange('geometry');
    }
    function renderResults(){
        results.replaceChildren();
        if(!frame||!analysis)return;
        const issues=analysis.issues;
        const errors=issues.filter(i=>i.severity==='error');
        const warnings=issues.filter(i=>i.severity==='review');
        const passes=issues.filter(i=>i.severity==='pass');
        const equipmentKg=fixtures.reduce((sum,f)=>sum+f.massKg,0);
        summary.textContent=`${analysis.status.toUpperCase()} · ${passes.length} passed · ${warnings.length} review · ${errors.length} blocked · ${equipmentKg.toLocaleString()} kg equipment (frame/guide hardware UNRATED)`;
        summary.dataset.status=analysis.status;
        for(const [title,list] of [['Needs review',warnings],['Mounting errors',errors],['Verified from preview data',passes]]){
            if(!list.length)continue;
            const h=document.createElement('h4');h.textContent=`${title} (${list.length})`;results.append(h);
            for(const event of list){
                const button=document.createElement('button');button.type='button';button.className=`fit-event ${event.severity}`;
                button.textContent=event.message;
                button.title='Tap to inspect/highlight this equipment';
                button.addEventListener('click',()=>selectFixture(event.fixtureIds[0]));
                results.append(button);
            }
        }
        renderSelection();
    }
    function renderSelection(){
        selected.textContent='Tap a visible component or diagnostic to inspect its physical interface.';
        if(!focus||!analysis)return;
        const fixture=fixtures.find(f=>f.id===focus),pose=analysis.poses.get(focus);
        if(!fixture||!pose)return;
        const socket=frame.sockets.find(s=>s.id===pose.socketId);
        const events=analysis.issues.filter(i=>i.severity!=='pass'&&i.fixtureIds.includes(focus));
        let guideText='';
        if(focus==='legs-yard'&&analysis.guidePlan?.ok)
            guideText='\nFIXED SIDE GUIDES (PREVIEW ONLY): '+
                analysis.guidePlan.bridges.map(b=>`${b.side<0?'L':'R'} ${b.span.toFixed(3)}m`).join(' · ')+
                '\nThe chassis bosses are joined to the actual leg-saddle receiver faces. Guide strength and mass are NOT simulated.';
        selected.textContent=`${fixture.name}\n${fixture.massKg} kg · ${fixture.envelope.join(' × ')} m\n`+
            `Mount: ${fixture.face} → ${socket.id} (${socket.standard})\n`+
            `Centre XYZ: ${pose.position.map(n=>n.toFixed(3)).join(', ')}\n`+
            `Interface XYZ: ${pose.matingWorld.map(n=>n.toFixed(3)).join(', ')}`+guideText+
            (events.length?`\n\nREVIEW:\n${events.map(i=>i.message).join('\n')}`:'\nNo envelope warnings for this component.');
    }
    function selectFixture(id){
        focus=id==null?null:String(id);
        for(const child of visual.children){
            child.userData.outline.visible=child.visible&&child.userData.fitFixtureId===focus;
        }
        renderSelection();
    }
    function setMode(next){
        if(next!=='bare'&&next!=='assembled')return;
        mode=next;visual.visible=mode==='assembled';
        for(const button of switchers)button.setAttribute('aria-pressed',String(button.dataset.assemblyMode===mode));
        visibility.hidden=mode!=='assembled';
        mobilityStudy.hidden=mode!=='assembled';
        results.parentElement.hidden=mode!=='assembled';
        applyVisibility();onVisualChange('mode');
    }
    function setMobilityModel(next){
        if(next!=='engineered'&&next!=='schematic')return;
        mobilityModel=next;
        for(const button of mobilityModels)
            button.setAttribute('aria-pressed',String(button.dataset.mobilityModel===next));
        guidesToggle.disabled=next!=='engineered';
        if(frame)rebuild();
    }
    for(const button of switchers)button.addEventListener('click',()=>setMode(button.dataset.assemblyMode));
    for(const button of mobilityModels)button.addEventListener('click',()=>setMobilityModel(button.dataset.mobilityModel));
    guidesToggle.addEventListener('change',()=>{if(frame)rebuild();});
    function setFrame(next){
        frame=next;focus=null;rebuild();
        visual.visible=mode==='assembled';
        applyVisibility();
    }
    function pick(clientX,clientY,camera,renderer){
        if(mode!=='assembled'||!visual.visible)return false;
        const rect=renderer.domElement.getBoundingClientRect();
        const pointer=new THREE.Vector2(((clientX-rect.left)/rect.width)*2-1,-((clientY-rect.top)/rect.height)*2+1);
        const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);
        const hit=ray.intersectObjects(visual.children,true).find(h=>h.object.userData.fitFixtureId);
        if(!hit)return false;
        selectFixture(hit.object.userData.fitFixtureId);return true;
    }
    setMode('bare');
    return {setFrame,setMode,setMobilityModel,pick,
        get mode(){return mode;},get mobilityModel(){return mobilityModel;},
        get visual(){return visual;},get guides(){return guides;},get analysis(){return analysis;}};
}
