/* Layout-only grouping shared by the two mathematical renderers. Domain checks,
   quantities, actions and persistence stay with their existing owners. */
(function(global){
 'use strict';
 function decorate(root){
  if(!root)return;
  const field=root.querySelector('.pv-fieldset');
  if(!field||field.querySelector('.math-pv-main,.pv-explanation,.pv-meaning')||!field.querySelector('.activity-instruction'))return;
  const children=Array.from(field.children),doc=root.ownerDocument;
  const task=doc.createElement('div'),model=doc.createElement('div'),tools=doc.createElement('div'),answer=doc.createElement('div');
  task.className='math-task workspace-task';task.setAttribute('data-workspace-focus','');task.tabIndex=-1;
  model.className='math-pv-main math-model';model.setAttribute('data-workspace-scroll','math-pv-model');model.setAttribute('role','region');model.setAttribute('aria-label','Предметная модель. Большое поле можно прокрутить.');model.tabIndex=0;tools.className='math-tools';answer.className='math-answer workspace-actions';
  for(const node of children){
   if(node.matches('.activity-instruction,.equation'))task.append(node);
   else if(node.matches('.board,.pv-fixed-model,.pv-two-models,.pv-place-table,.pv-digit-bank'))model.append(node);
   else if(node.matches('.toolbox,.exchange-tools,.board-actions'))tools.append(node);
   else answer.append(node);
  }
  field.classList.add('math-pv-workbench');
  if(!model.childElementCount)field.classList.add('math-pv-no-model');
  const dock=doc.createElement('div');dock.className='math-pv-dock';dock.setAttribute('data-workspace-scroll','math-answer-dock');
  for(const node of Array.from(answer.children))if(node.matches('.pv-answer-label,.pv-fields,.pv-choice-row,.pv-check-row'))dock.append(node);
  if(dock.childElementCount)answer.prepend(dock);
  if(model.querySelector('.board:not(.single-board)'))field.classList.add('math-pv-two-zones');
  field.append(task,model,tools,answer);
  // Empty grid slots should not create a blank column for text-only cards.
  tools.hidden=!tools.childElementCount;model.hidden=!model.childElementCount;
 }
 global.MathWorkspace=Object.freeze({decorate});
})(window);
