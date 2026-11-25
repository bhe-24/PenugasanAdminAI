// Visual SVG & CSS Articulated Bear Renderer (8 Stages of Growth + Sleeping / Moods)
(function (global) {
    const STAGE_META = [
        { stage: 0, title: 'Tertidur Pulas', sub: 'Belum bangun', icon: '💤' },
        { stage: 1, title: 'Bayi', sub: 'baru lahir', icon: '🍼' },
        { stage: 2, title: 'Balita', sub: 'mulai merangkak', icon: '🐾' },
        { stage: 3, title: 'Anak-anak', sub: 'mulai berdiri', icon: '🌱' },
        { stage: 4, title: 'Remaja Awal', sub: 'lebih aktif', icon: '👋' },
        { stage: 5, title: 'Remaja', sub: 'mulai mandiri', icon: '🎒' },
        { stage: 6, title: 'Dewasa Muda', sub: 'berkembang', icon: '👍' },
        { stage: 7, title: 'Dewasa', sub: 'penuh percaya diri', icon: '✨' },
        { stage: 8, title: 'Tua', sub: 'bijaksana', icon: '🪄' }
    ];

    const FUR = '#162B4E';
    const FUR_MID = '#203C6B';
    const FUR_DARK = '#0E1C36';
    const CREAM = '#FFF4DD';
    const CHEEK = '#F49FB6';
    const SCARF = '#F4B844';
    const SCARF_DARK = '#D99B26';

    function renderBookLogo(cx, cy) {
        return `
            <g transform="translate(${cx - 6}, ${cy - 4})">
                <path d="M0 1 C2 0, 5 0.5, 6 2 L6 8 C4.5 7, 2 7, 0 8 Z" fill="#FFFFFF"/>
                <path d="M12 1 C10 0, 7 0.5, 6 2 L6 8 C7.5 7, 10 7, 12 8 Z" fill="#FFFFFF"/>
            </g>
        `;
    }

    function renderFace(opts = {}) {
        const {
            cx = 130,
            cy = 72,
            scale = 1,
            eyesClosed = false,
            winkLeft = false,
            openSmile = true
        } = opts;

        const leftEye = eyesClosed || winkLeft
            ? `<path d="M-21 -3 Q-15 3 -9 -3" fill="none" stroke="${CREAM}" stroke-width="2.6" stroke-linecap="round"/>`
            : `<g class="bear-eyes-open"><circle cx="-15" cy="-4" r="5" fill="#0B1324"/><circle cx="-13.5" cy="-6" r="1.9" fill="#FFFFFF"/></g>`;

        const rightEye = eyesClosed
            ? `<path d="M9 -3 Q15 3 21 -3" fill="none" stroke="${CREAM}" stroke-width="2.6" stroke-linecap="round"/>`
            : `<g class="bear-eyes-open"><circle cx="15" cy="-4" r="5" fill="#0B1324"/><circle cx="16.5" cy="-6" r="1.9" fill="#FFFFFF"/></g>`;

        const mouth = eyesClosed
            ? `<path d="M-4 9 Q0 12 4 9" fill="none" stroke="${FUR_DARK}" stroke-width="2" stroke-linecap="round"/>`
            : openSmile
                ? `<path d="M-6 8 Q0 16 6 8 Z" fill="#7F1D1D" stroke="${FUR_DARK}" stroke-width="1.6"/>`
                : `<path d="M-6 9 Q0 13 6 9" fill="none" stroke="${FUR_DARK}" stroke-width="2" stroke-linecap="round"/>`;

        return `
            <g class="bear-head" transform="translate(${cx}, ${cy}) scale(${scale})">
                <g class="bear-ear-l">
                    <circle cx="-30" cy="-24" r="13" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                    <circle cx="-30" cy="-24" r="7" fill="${FUR_MID}"/>
                </g>
                <g class="bear-ear-r">
                    <circle cx="30" cy="-24" r="13" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                    <circle cx="30" cy="-24" r="7" fill="${FUR_MID}"/>
                </g>
                <ellipse cx="0" cy="0" rx="39" ry="33" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.2"/>
                <ellipse cx="-24" cy="6" rx="6.5" ry="4.5" fill="${CHEEK}" opacity="0.85"/>
                <ellipse cx="24" cy="6" rx="6.5" ry="4.5" fill="${CHEEK}" opacity="0.85"/>
                <ellipse cx="0" cy="8" rx="14.5" ry="11" fill="${CREAM}"/>
                <ellipse cx="0" cy="3" rx="5.5" ry="3.8" fill="${FUR_DARK}"/>
                ${mouth}
                ${leftEye}
                ${rightEye}
            </g>
        `;
    }

    function renderSleepZzz() {
        return `
            <g class="bear-fx">
                <text x="172" y="88" font-size="16" font-weight="900" fill="#FDE68A" class="ta-zzz-1">Z</text>
                <text x="188" y="72" font-size="13" font-weight="900" fill="#BAE6FD" class="ta-zzz-2">z</text>
                <text x="202" y="56" font-size="11" font-weight="900" fill="#E0F2FE" class="ta-zzz-3">z</text>
            </g>
        `;
    }

    function renderSparkles() {
        return `
            <g class="bear-fx">
                <path class="ta-sparkle" d="M50 56 L53 64 L61 67 L53 70 L50 78 L47 70 L39 67 L47 64 Z" fill="#F4B844"/>
                <path class="ta-sparkle" style="animation-delay:0.5s" d="M210 48 L212 54 L218 56 L212 58 L210 64 L208 58 L202 56 L208 54 Z" fill="#FBBF24"/>
                <circle class="ta-sparkle" style="animation-delay:0.9s" cx="215" cy="95" r="3.5" fill="#F4B844"/>
            </g>
        `;
    }

    function buildBearSvg(stage, mood) {
        const isSleepPose = stage === 0 || stage === 1 || mood === 'sleeping' || mood === 'sad_sleep';
        const effectiveStage = mood === 'sleeping' || mood === 'sad_sleep' ? Math.min(stage, 1) : stage;

        if (isSleepPose) {
            return `
                <svg class="ta-bear-svg bear-svg-sleep mood-${mood}" viewBox="0 0 260 205" aria-label="Si Beruang sedang tidur">
                    <ellipse cx="132" cy="176" rx="76" ry="12" fill="rgba(15,23,42,0.22)"/>
                    <g class="bear-whole">
                        <circle class="bear-tail" cx="195" cy="144" r="10" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                        <g class="bear-torso bear-sleep-back">
                            <ellipse cx="148" cy="146" rx="46" ry="28" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.2"/>
                            <path d="M108 134 C118 148, 128 158, 122 170 L103 158 Z" fill="${SCARF}" stroke="${SCARF_DARK}" stroke-width="1.6"/>
                            <ellipse cx="176" cy="164" rx="14" ry="9" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                            <ellipse cx="180" cy="165" rx="7" ry="4.5" fill="${CREAM}"/>
                        </g>
                        <g class="bear-arm-l">
                            <ellipse cx="82" cy="166" rx="14" ry="8" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                            <ellipse cx="77" cy="166" rx="6" ry="4" fill="${CREAM}"/>
                        </g>
                        ${renderFace({ cx: 98, cy: 136, scale: 0.9, eyesClosed: true, openSmile: false })}
                    </g>
                    ${renderSleepZzz()}
                </svg>
            `;
        }

        // Tahap 2: Balita (mulai merangkak)
        if (effectiveStage === 2) {
            return `
                <svg class="ta-bear-svg bear-svg-crawl mood-${mood}" viewBox="0 0 260 205" aria-label="Beruang Balita merangkak">
                    <ellipse cx="130" cy="178" rx="68" ry="11" fill="rgba(0,31,63,0.12)"/>
                    <g class="bear-whole">
                        <circle class="bear-tail" cx="80" cy="138" r="10" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                        <g class="bear-torso">
                            <ellipse cx="128" cy="142" rx="42" ry="26" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.2"/>
                            <path d="M126 118 C142 130, 152 146, 134 158 C118 146, 114 132, 126 118 Z" fill="${SCARF}" stroke="${SCARF_DARK}" stroke-width="1.6"/>
                            ${renderBookLogo(132, 137)}
                        </g>
                        <g class="bear-arm-l">
                            <ellipse cx="95" cy="168" rx="13" ry="8.5" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                            <ellipse cx="94" cy="169" rx="6" ry="4" fill="${CREAM}"/>
                        </g>
                        <g class="bear-arm-r">
                            <ellipse cx="162" cy="167" rx="14" ry="8.5" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                            <ellipse cx="164" cy="168" rx="6" ry="4" fill="${CREAM}"/>
                        </g>
                        ${renderFace({ cx: 146, cy: 96, scale: 0.96, eyesClosed: false, openSmile: true })}
                    </g>
                    ${mood === 'celebrating' ? renderSparkles() : ''}
                </svg>
            `;
        }

        // Tahap 3 - 8 (Berdiri / Duduk Tegap sesuai karakter)
        const hasBackpack = effectiveStage === 5 || effectiveStage === 6;
        const isWave = effectiveStage === 4;
        const isThumb = effectiveStage === 6;
        const isCrossed = effectiveStage === 7;
        const hasCane = effectiveStage === 8;

        const svgMods = [
            isWave ? 'bear-svg-wave' : '',
            isThumb ? 'bear-svg-thumb' : '',
            `mood-${mood}`
        ].filter(Boolean).join(' ');

        const backpackHtml = hasBackpack ? `
            <g class="bear-backpack">
                <rect x="84" y="108" width="92" height="54" rx="18" fill="${SCARF}" stroke="${SCARF_DARK}" stroke-width="2.2"/>
            </g>
        ` : '';

        const strapsHtml = hasBackpack ? `
            <path d="M107 110 C102 128, 102 142, 108 154" fill="none" stroke="${SCARF_DARK}" stroke-width="5.5" stroke-linecap="round"/>
            <path d="M153 110 C158 128, 158 142, 152 154" fill="none" stroke="${SCARF_DARK}" stroke-width="5.5" stroke-linecap="round"/>
        ` : '';

        let armsHtml = '';
        if (isWave) {
            armsHtml = `
                <g class="bear-arm-l">
                    <ellipse cx="94" cy="136" rx="11" ry="18" transform="rotate(14 94 136)" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                </g>
                <g class="bear-arm-r">
                    <ellipse cx="174" cy="108" rx="10" ry="20" transform="rotate(35 174 108)" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                    <circle cx="184" cy="92" r="5" fill="${CREAM}"/>
                </g>
            `;
        } else if (isThumb) {
            armsHtml = `
                <g class="bear-arm-l">
                    <ellipse cx="88" cy="120" rx="10" ry="18" transform="rotate(-30 88 120)" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                    <ellipse cx="78" cy="102" rx="4" ry="7" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1.6"/>
                </g>
                <g class="bear-arm-r">
                    <ellipse cx="166" cy="136" rx="11" ry="18" transform="rotate(-14 166 136)" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                </g>
            `;
        } else if (isCrossed) {
            armsHtml = `
                <g class="bear-torso">
                    <rect x="98" y="128" width="64" height="17" rx="8.5" fill="${FUR_MID}" stroke="${FUR_DARK}" stroke-width="2"/>
                    <ellipse cx="114" cy="136" rx="12" ry="7" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1.8"/>
                    <ellipse cx="146" cy="136" rx="12" ry="7" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1.8"/>
                </g>
            `;
        } else if (hasCane) {
            armsHtml = `
                <g class="bear-cane">
                    <path d="M130 142 L130 183" stroke="#78350F" stroke-width="5.5" stroke-linecap="round"/>
                    <path d="M122 142 C122 133, 138 133, 138 142" fill="none" stroke="#92400E" stroke-width="5" stroke-linecap="round"/>
                </g>
                <g class="bear-arm-l">
                    <ellipse cx="106" cy="138" rx="18" ry="10" transform="rotate(14 106 138)" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                </g>
                <g class="bear-arm-r">
                    <ellipse cx="154" cy="138" rx="18" ry="10" transform="rotate(-14 154 138)" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                </g>
            `;
        } else {
            armsHtml = `
                <g class="bear-arm-l">
                    <ellipse cx="95" cy="134" rx="11" ry="17" transform="rotate(18 95 134)" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                </g>
                <g class="bear-arm-r">
                    <ellipse cx="165" cy="134" rx="11" ry="17" transform="rotate(-18 165 134)" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                </g>
            `;
        }

        const faceProps = {
            cx: 130,
            cy: effectiveStage === 3 ? 80 : 72,
            scale: effectiveStage === 3 ? 0.94 : 1,
            eyesClosed: effectiveStage === 7 || effectiveStage === 8,
            winkLeft: effectiveStage === 6,
            openSmile: effectiveStage >= 3 && effectiveStage <= 6
        };

        const bodyW = effectiveStage >= 7 ? 38 : 32;
        const bodyH = effectiveStage >= 7 ? 36 : 31;
        const bodyY = effectiveStage === 3 ? 142 : 138;

        return `
            <svg class="ta-bear-svg ${svgMods}" viewBox="0 0 260 205" aria-label="Si Beruang Tahap ${effectiveStage}">
                <ellipse cx="130" cy="184" rx="54" ry="10" fill="rgba(0,31,63,0.12)"/>
                <g class="bear-whole">
                    <circle class="bear-tail" cx="92" cy="160" r="9" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                    ${backpackHtml}
                    <g class="bear-legs">
                        <ellipse cx="111" cy="174" rx="14" ry="10" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                        <ellipse cx="111" cy="176" rx="8" ry="5" fill="${CREAM}"/>
                        <ellipse cx="149" cy="174" rx="14" ry="10" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2"/>
                        <ellipse cx="149" cy="176" rx="8" ry="5" fill="${CREAM}"/>
                    </g>
                    <g class="bear-torso">
                        <ellipse cx="130" cy="${bodyY}" rx="${bodyW}" ry="${bodyH}" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="2.2"/>
                        <ellipse cx="130" cy="${bodyY + 4}" rx="${bodyW - 14}" ry="${bodyH - 13}" fill="${FUR_MID}" opacity="0.5"/>
                        ${strapsHtml}
                        <g class="bear-scarf">
                            <path d="M104 109 Q130 120 156 109 L146 130 Q130 137 114 130 Z" fill="${SCARF}" stroke="${SCARF_DARK}" stroke-width="1.8"/>
                            ${renderBookLogo(130, 118)}
                        </g>
                    </g>
                    ${armsHtml}
                    ${renderFace(faceProps)}
                </g>
                ${(mood === 'celebrating' || effectiveStage >= 6) ? renderSparkles() : ''}
            </svg>
        `;
    }

    function renderBearStage(containerEl, opts = {}) {
        if (!containerEl) return;
        const stage = Math.max(0, Math.min(8, Number(opts.stage) || 0));
        const mood = opts.mood || (stage === 0 ? 'sleeping' : 'idle');
        containerEl.innerHTML = buildBearSvg(stage, mood);
    }

    global.TulisAkuBear = {
        STAGE_META,
        renderBearStage
    };
})(window);
