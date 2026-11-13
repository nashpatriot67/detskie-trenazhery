/* Original inline illustrations for Slovograd. All shapes are bundled and work offline. */
(function(){
  'use strict';
  const owlBody = `
    <ellipse cx="91" cy="166" rx="59" ry="7" fill="#d7ded0" opacity=".46"/>
    <path d="M45 81 42 38Q65 40 77 52Q91 47 105 52Q120 40 140 39L137 83Z" fill="#78a38b"/>
    <path d="M49 72 49 47 70 58M112 59 133 48 133 74" fill="#a7c4a5"/>
    <path d="M45 83Q40 60 62 54Q91 42 121 54Q143 61 139 86L143 122Q143 159 92 164Q40 159 40 122Z" fill="#7da58e"/>
    <path d="M49 91Q36 93 31 112Q25 131 42 143L60 124Z" fill="#5f8d79"/>
    <path d="M132 91Q148 91 153 110Q162 128 143 142L125 123Z" fill="#5f8d79"/>
    <path d="M91 65Q68 46 51 65Q34 84 51 105Q66 122 91 107Q117 123 132 104Q150 83 132 65Q114 48 91 65Z" fill="#fbf4df"/>
    <ellipse cx="91" cy="129" rx="31" ry="30" fill="#c4d1aa"/>
    <path d="m76 119 4 5 4-5m14 0 4 5 4-5m-23 14 4 5 4-5m7 0 4 5 4-5" stroke="#8da583" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="68" cy="83" r="18" fill="#fffdf5"/>
    <circle cx="114" cy="83" r="18" fill="#fffdf5"/>
    <circle cx="69" cy="85" r="9" fill="#384a42"/>
    <circle cx="113" cy="85" r="9" fill="#384a42"/>
    <circle cx="72" cy="81" r="3" fill="#fffdf7"/>
    <circle cx="116" cy="81" r="3" fill="#fffdf7"/>
    <path d="m85 98 6 8 7-8q-6-5-13 0" fill="#e7b65d"/>
    <ellipse cx="53" cy="101" rx="8" ry="4.5" fill="#eab298" opacity=".8"/>
    <ellipse cx="130" cy="101" rx="8" ry="4.5" fill="#eab298" opacity=".8"/>
    <path d="M57 65q9-5 17-1m33 0q9-4 17 1" fill="none" stroke="#629079" stroke-width="3" stroke-linecap="round"/>
    <path d="M37 129Q64 122 91 137Q119 122 146 129L145 157Q119 150 91 166Q64 151 38 157Z" fill="#5a8d92"/>
    <path d="M41 125Q66 122 91 136L91 160Q67 148 42 152Z" fill="#fff9e8"/>
    <path d="M91 136Q119 120 141 125L140 152Q116 148 91 160Z" fill="#fffdf3"/>
    <path d="M91 136v24" stroke="#d9cba8" stroke-width="1.5"/>
    <path d="m49 133 29 7m-29 0 29 7m25-6 28-8m-28 15 28-8" fill="none" stroke="#d9d5c3" stroke-width="2" stroke-linecap="round"/>
    <path d="M43 112q-10 6-7 17q5 4 15-1l8-10m80-6q10 6 7 17q-5 4-15-1l-8-10" fill="#7da58e"/>
    <path d="m43 116 10 6m86-6-10 6" fill="none" stroke="#648f7a" stroke-width="2" stroke-linecap="round"/>
  `;
  const owl = `<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Сова Соня читает книгу" focusable="false">${owlBody}</svg>`;
  const hero = `<svg viewBox="0 0 420 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Книжный городок и Сова Соня с раскрытой книгой" focusable="false">
    <path d="M41 165Q23 110 74 72Q113 42 172 54Q209 19 264 46Q323 39 355 79Q404 101 381 156Q390 215 335 237Q287 261 233 240Q174 264 126 242Q63 239 41 201Z" fill="#e7eedf"/>
    <ellipse cx="220" cy="239" rx="167" ry="14" fill="#d9e1cd" opacity=".64"/>
    <path d="M55 89q-14 0-14-10q0-9 12-9q5-16 19-10q11-5 17 6q12 0 14 10q0 13-16 13Z" fill="#fffdf3"/>
    <path d="M297 68q-10 0-10-8q0-6 9-7q4-12 14-8q9-3 13 5q10 0 11 8q0 10-12 10Z" fill="#fffdf3"/>
    <path d="m190 38 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#e6c96f"/>
    <path d="m371 121 2 5 6 2-6 3-2 5-2-5-5-3 5-2Z" fill="#c6b7d8"/>
    <circle cx="113" cy="38" r="3" fill="#dab2a5"/>
    <circle cx="347" cy="90" r="3" fill="#b0c5a5"/>
    <circle cx="61" cy="157" r="2" fill="#c6b7d8"/>
    <path d="M85 217V111l34-26 35 26v106Z" fill="#f3d4af"/>
    <path d="m77 113 41-34 43 34-7 8-36-27-35 27Z" fill="#dd9b83"/>
    <path d="M92 119h51v89H92Z" fill="#f8e4c8"/>
    <path d="M96 128h42m-42 10h42m-42 10h42m-42 10h42m-42 10h42m-42 10h42m-42 10h42m-42 10h42" stroke="#e7cba5" stroke-width="2"/>
    <rect x="107" y="124" width="23" height="27" rx="10" fill="#e8a18a"/>
    <path d="M118.5 125v25m-10-12h21" stroke="#fff2db" stroke-width="2"/>
    <path d="M110 216v-32q0-10 10-10q10 0 10 10v32" fill="#ae9dc1"/>
    <circle cx="125" cy="195" r="1.6" fill="#f5e4bc"/>
    <path d="M157 219V145l22-17 26 17v74Z" fill="#c5d7c0"/>
    <path d="m151 147 27-24 32 24-6 6-26-18-22 18Z" fill="#91af9c"/>
    <rect x="169" y="152" width="20" height="18" rx="4" fill="#f9f3d9"/>
    <path d="M179 153v16m-9-8h18" stroke="#c8cba9" stroke-width="2"/>
    <path d="M168 184h24m-24 9h24m-24 9h24" stroke="#a6c1a8" stroke-width="2" stroke-linecap="round"/>
    <path d="M78 229q-8-24-23-31q-14 1-8 15q8 11 31 16" fill="#91b295"/>
    <path d="M79 228q-2-32 13-41q13 3 8 17q-7 12-21 24" fill="#b1c59b"/>
    <path d="M80 236q-6-22-20-32m20 32 12-39" stroke="#6e977a" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M48 234q19-12 48-3l2 6q-24-6-46 4Z" fill="#d8aa78"/>
    <g transform="rotate(-8 137 231)">
      <rect x="107" y="222" width="78" height="11" rx="4" fill="#d79e8b"/>
      <path d="M111 224h67v6h-67" fill="#fff3da"/>
      <rect x="117" y="210" width="68" height="12" rx="4" fill="#a998bf"/>
      <path d="M122 212h58v7h-58" fill="#f7f1dc"/>
      <rect x="111" y="198" width="79" height="12" rx="4" fill="#8fac9b"/>
      <path d="M117 200h67v7h-67" fill="#fff4df"/>
    </g>
    <g transform="translate(207 67) scale(.99)">${owlBody}</g>
    <path d="M368 231q-5-26 7-43q14-12 18-1q1 15-25 44" fill="#a9c49c"/>
    <path d="M369 231q-1-20-14-31q-16-8-15 6q6 15 29 25" fill="#7fa98a"/>
    <path d="m366 237 15-44m-15 44-17-29" stroke="#659374" stroke-width="2" stroke-linecap="round"/>
    <path d="M359 229h22l-3 17h-16Z" fill="#dba78e"/>
    <path d="M351 102 368 84l7 7-17 18Z" fill="#e7c66d"/>
    <path d="m351 102-4 12 11-5Z" fill="#f3dfb8"/>
    <path d="m347 114 3-7 4 4Z" fill="#758f89"/>
    <path d="m367 85 5-5q3-3 6 0l1 1q3 3 0 6l-4 5Z" fill="#dfa18e"/>
    <path d="m357 98 12-12" stroke="#f8e3a0" stroke-width="2"/>
    <path d="M205 82q-10-15-19-10q-4 10 11 18q-5-16 6-19q10 2 7 12" fill="#b9a6ce"/>
    <path d="m204 79-3 14" stroke="#a18db7" stroke-width="2" stroke-linecap="round"/>
    <path d="M220 251h64m-115-5h24m109 3h28" stroke="#c9d4bd" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
  window.RUS_ART={owl,hero};
})();
