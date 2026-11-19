'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({});
for(const file of ['life-quest-data.js','life-school-schedule.js','object-art.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const D=ctx.LifeQuestData,A=ctx.ObjectArt;let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),m);checks++;};
eq(A.ids.length,126,'Every current base/scheduled item has one authored object illustration');
eq([...A.ids].sort(),Object.keys(D.items).sort(),'No semantic item is replaced by an unrelated fallback or orphan asset');
for(const id of A.ids){
 const svg=A.markup(id),inner=A.inner(id),item=D.items[id];
 ok(svg.startsWith('<svg ')&&svg.endsWith('</svg>'),id+' full accessible SVG');
 ok(svg.includes('viewBox="0 0 100 100"'),id+' stable scene coordinate frame');
 ok(svg.includes('role="img"')&&svg.includes('aria-label="'+item.label+'"'),id+' exact authored name');
 ok(svg.includes('data-art-id="'+id+'"')&&inner.includes('data-object-art="'+id+'"'),id+' same bank/scene identity');
 ok(inner.length>170&&/<(?:path|ellipse|rect)\b/.test(inner),id+' real vector object geometry');
 ok(!/<(?:script|foreignObject|image|iframe)\b|on(?:load|click|error)=|(?:https?:|data:|url\()/i.test(inner),id+' self contained safe offline art');
 ok(!/[\p{Extended_Pictographic}]/u.test(svg),id+' never depends on emoji platform rendering');
 const decorative=A.markup(id,{decorative:true});ok(decorative.includes('aria-hidden="true"')&&!decorative.includes('<title>'),id+' no repeated screenreader name inside named button');
}
const semantic={
 'pencil-case':'pencil-case',towel:'terry-towel','swim-cap':'silicone-swim-cap',goggles:'swimming-goggles',water:'drinking-water-bottle',eraser:'eraser',glue:'glue-stick',drumsticks:'drumsticks','guitar-pick':'guitar-pick',flute:'recorder','warm-hat':'knitted-winter-hat','art-water-cup':'non-spill-painting-cup','brush-case':'paintbrush-case',sharpener:'container-pencil-sharpener','pet-toy':'pet-toy-mouse','pet-water-bowl':'empty-pet-water-bowl','pool-slippers':'pool-slippers','pool-wet-bag':'waterproof-bag',paints:'watercolor-set',brush:'paintbrush','art-album':'drawing-album','shoe-bag':'drawstring-shoe-bag','knee-pads':'pair-knee-protectors','safe-scissors':'rounded-child-scissors-with-case',plasticine:'plasticine-set','model-board':'modeling-board','profession-cards':'profession-cards-envelope','observation-sheet':'observation-worksheet'
};
for(const [id,kind]of Object.entries(semantic))eq(A.describe(id).kind,kind,id+' explicit semantic audit of former ambiguous symbol');
for(const [id,state] of Object.entries({'clean-shirt':'clean','dry-gymshirt':'clean','clean-socks':'clean','dirty-shirt':'dirty','dirty-socks':'dirty','dirty-towel':'dirty','wet-swimwear':'wet','wet-goggles':'wet','rinsed-brush':'wet','spare-underwear':'clean'})){
 eq(A.describe(id).state,state,id+' visible authored state');
 const clean=({'dirty-shirt':'clean-shirt','dirty-socks':'clean-socks','dirty-towel':'towel','wet-swimwear':'swimwear','wet-goggles':'goggles','rinsed-brush':'brush'})[id];
 if(clean)ok(A.inner(id)!==A.inner(clean),id+' state has distinct picture, not only label');
}
for(const id of A.ids.filter(id=>D.items[id].illustration.type==='shape')){
 const info=A.describe(id),it=D.items[id];
 for(const key of ['color','shape','size','material'])eq(info[key],it[key],id+' sorting cue '+key+' remains mathematically exact');
 ok(A.inner(id).includes(it.size==='small'?'scale(0.62)':'scale(1)'),id+' small/large proportion retained');
}
for(const id of ['storybook','comics','reading-book','club-book'])ok(!A.inner(id).includes('УЧЕБНИК'),id+' fiction/club reading is not labeled a school textbook');
for(const id of ['math-book','russian-book','world-book','foreign-book'])ok(A.inner(id).includes('УЧЕБНИК'),id+' textbook correctly identified');
for(const id of ['school-diary','reader-diary'])ok(!A.inner(id).includes('>ТЕТРАДЬ<'),id+' diary correctly identified');
ok(A.markup('math-book',{label:'<unsafe "name">'}).includes('&lt;unsafe &quot;name&quot;&gt;'),'accessible override is escaped');
eq(A.markup('unknown-item'),'', 'Unknown future item never receives a misleading existing picture');
eq(A.inner('__proto__'),'', 'Unknown inherited names cannot access an artwork');
eq(A.has('__proto__'),false);eq(A.describe('missing'),null);
ok(fs.statSync(path.join(root,'object-art.js')).size<100*1024,'The entire126-item atlas remains small and offline friendly');
console.log(JSON.stringify({success:true,checks,items:A.ids.length,sourceBytes:fs.statSync(path.join(root,'object-art.js')).size,independentSemanticChecks:Object.keys(semantic).length},null,2));
