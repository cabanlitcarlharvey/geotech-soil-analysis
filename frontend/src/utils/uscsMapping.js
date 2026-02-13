// src/utils/uscsMapping.js
export const getUscsMapping = ({ gravel_percent, sand_percent, fines_percent }) => {
    const g = Number(gravel_percent ?? 0);
    const s = Number(sand_percent ?? 0);
    const f = Number(fines_percent ?? 0);
  
    if (![g, s, f].every((n) => Number.isFinite(n))) {
      return {
        title: "USCS Mapping",
        headline: "Insufficient data",
        symbol: "—",
        path: ["Missing percentages"],
        notes: ["No mapping computed."],
      };
    }
  
    // Fine-grained (≥50% fines)
    if (f >= 50) {
      return {
        title: "USCS Mapping",
        headline: "Fine-grained soil (≥ 50% fines)",
        symbol: "CL / ML / CH / MH (needs LL & PI)",
        path: [
          `Fines = ${f.toFixed(2)}% (≥ 50%) → Fine-grained`,
          "To finalize: Atterberg Limits (Liquid Limit, Plasticity Index)",
        ],
        notes: ["Exact symbol needs LL/PI (plasticity chart)."],
      };
    }
  
    // Coarse-grained (<50% fines)
    const coarseType = g >= s ? "GRAVEL" : "SAND";
    const finesBand = f < 5 ? "<5%" : f <= 12 ? "5–12%" : ">12%";
  
    if (coarseType === "GRAVEL") {
      if (f < 5) {
        return {
          title: "USCS Mapping",
          headline: "Coarse-grained (Gravel-dominant), clean gravel",
          symbol: "GW or GP (needs Cu & Cc)",
          path: [
            `Fines = ${f.toFixed(2)}% (< 50%) → Coarse-grained`,
            `Gravel = ${g.toFixed(2)}% ≥ Sand = ${s.toFixed(2)}% → Gravel`,
            `Fines band = ${finesBand} → Clean gravel`,
            "To finalize GW or GP: gradation (Cu, Cc)",
          ],
          notes: ["GW = well-graded gravel; GP = poorly graded gravel (need sieve data)."],
        };
      }
  
      if (f <= 12) {
        return {
          title: "USCS Mapping",
          headline: "Coarse-grained (Gravel-dominant), gravel with some fines",
          symbol: "GW-GM / GW-GC / GP-GM / GP-GC (needs Cu/Cc + fines type)",
          path: [
            `Fines = ${f.toFixed(2)}% (< 50%) → Coarse-grained`,
            `Gravel = ${g.toFixed(2)}% ≥ Sand = ${s.toFixed(2)}% → Gravel`,
            `Fines band = ${finesBand} → Dual symbol (with fines)`,
            "To finalize: gradation (Cu, Cc) + fines type (silt, clay)",
          ],
          notes: ["GM/GC depends on fines (silt or clay) — needs PI/LL or manual ID."],
        };
      }
  
      return {
        title: "USCS Mapping",
        headline: "Coarse-grained (Gravel-dominant), gravel with fines",
        symbol: "GM or GC (needs fines type)",
        path: [
          `Fines = ${f.toFixed(2)}% (< 50%) → Coarse-grained`,
          `Gravel = ${g.toFixed(2)}% ≥ Sand = ${s.toFixed(2)}% → Gravel`,
          `Fines band = ${finesBand} → Gravel with fines`,
          "To finalize GM or GC: fines type (silt, clay) via PI/LL",
        ],
        notes: ["GM = silty gravel; GC = clayey gravel."],
      };
    }
  
    // SAND branch
    if (f < 5) {
      return {
        title: "USCS Mapping",
        headline: "Coarse-grained (Sand-dominant), clean sand",
        symbol: "SW or SP (needs Cu & Cc)",
        path: [
          `Fines = ${f.toFixed(2)}% (< 50%) → Coarse-grained`,
          `Sand = ${s.toFixed(2)}% > Gravel = ${g.toFixed(2)}% → Sand`,
          `Fines band = ${finesBand} → Clean sand`,
          "To finalize SW or SP: gradation (Cu, Cc)",
        ],
        notes: ["SW = well-graded sand; SP = poorly graded sand (need sieve data)."],
      };
    }
  
    if (f <= 12) {
      return {
        title: "USCS Mapping",
        headline: "Coarse-grained (Sand-dominant), sand with some fines",
        symbol: "SW-SM / SW-SC / SP-SM / SP-SC (needs Cu/Cc + fines type)",
        path: [
          `Fines = ${f.toFixed(2)}% (< 50%) → Coarse-grained`,
          `Sand = ${s.toFixed(2)}% > Gravel = ${g.toFixed(2)}% → Sand`,
          `Fines band = ${finesBand} → Dual symbol (with fines)`,
          "To finalize: gradation (Cu, Cc) + fines type (silt, clay)",
        ],
        notes: ["SM/SC depends on fines (silt, clay) — needs PI/LL or manual ID."],
      };
    }
  
    return {
      title: "USCS Mapping",
      headline: "Coarse-grained (Sand-dominant), sand with fines",
      symbol: "SM or SC (needs fines type)",
      path: [
        `Fines = ${f.toFixed(2)}% (< 50%) → Coarse-grained`,
        `Sand = ${s.toFixed(2)}% > Gravel = ${g.toFixed(2)}% → Sand`,
        `Fines band = ${finesBand} → Sand with fines`,
        "To finalize SM or SC: fines type (silt, clay) via PI/LL",
      ],
      notes: ["SM = silty sand; SC = clayey sand."],
    };
  };
  