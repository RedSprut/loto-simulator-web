/* All math-model dialogs keep a viewport-fixed close affordance.  The button is
   deliberately outside the scroll flow visually, so swiping the sheet never
   moves it away from the user's reach. */
(function(){
  const MODAL_CLOSES={
    'sg-ov':()=>window.closeSG?.(),
    'if-ov':()=>window.IF_close?.(),
    'qa-ov':()=>window.QA_close?.(),
    'pdx-ov':()=>window.PDX_close?.(),
    'adv-ov':()=>window.ADV_close?.(),
    'cons-ov':()=>window.CONS_close?.(),
    'pick-ov':()=>window.PICK_close?.(),
    'matrix-ov':()=>window.MATRIX_close?.(),
    'mres-ov':()=>window.LotoModals?.closeModal('mres-ov')||document.getElementById('mres-ov')?.classList.remove('show'),
    'period-ov':()=>window.PERIOD_close?.(),
    'genn-ov':()=>window.GENN_close?.(),
    'wc-ov':()=>window.WC_close?.(),
    'sup-ov':()=>window.SUP_close?.(),
    'supc-ov':()=>window.SUPC_close?.(),
    'ticket-ov':()=>window.TK_close?.(),
    'horo-ov':()=>window.HORO_close?.(),
    'qab-ov':()=>window.QAB_close?.(),
    'jc-ov':()=>window.JC_close?.()
  };
  function install(){
    Object.entries(MODAL_CLOSES).forEach(([id,close])=>{
      const ov=document.getElementById(id);if(!ov)return;
      let btn=Array.from(ov.querySelectorAll('button')).find(b=>b.textContent.trim()==='✕');
      if(!btn){
        btn=document.createElement('button');btn.type='button';btn.textContent='✕';
        ov.appendChild(btn);
      }else if(btn.parentElement!==ov){
        /* A fixed descendant of a transformed/scrolling sheet is still tied to
           that sheet. Move the existing affordance to the overlay root so it
           remains fixed to the viewport while the sheet is swiped. */
        ov.appendChild(btn);
      }
      btn.classList.add('modal-static-close');
      btn.setAttribute('aria-label',appText('Закрыть'));
      if(id!=='mres-ov')btn.onclick=e=>{e.stopPropagation();close();};
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  document.addEventListener('loto:language-changed',()=>document.querySelectorAll('.modal-static-close').forEach(b=>b.setAttribute('aria-label',appText('Закрыть'))));
})();
