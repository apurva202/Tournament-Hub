/**
 * Core pure tournament logic: Round-Robin (circle method) and Knockout Bracket generation
 */

/**
 * Generates round-robin fixtures using the Berger / circle method.
 * @param {Array<string>} participantIds - Array of participant ObjectId strings
 * @returns {Array<{ round: number, roundLabel: string, matchNumber: number, teamA: string, teamB: string }>}
 */
function roundRobin(participantIds) {
  if (!participantIds || participantIds.length < 2) {
    return [];
  }

  // Clone list
  const teams = [...participantIds];

  // If odd number of teams, add null (bye)
  if (teams.length % 2 !== 0) {
    teams.push(null);
  }

  const numTeams = teams.length;
  const numRounds = numTeams - 1;
  const matchesPerRound = numTeams / 2;

  const schedule = [];
  let matchCounter = 1;

  for (let round = 1; round <= numRounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const teamA = teams[i];
      const teamB = teams[numTeams - 1 - i];

      // Omit bye matches
      if (teamA !== null && teamB !== null) {
        // Alternate home and away to balance venues
        const isAlternate = (round % 2 === 1) && (i === 0);
        schedule.push({
          round,
          roundLabel: `Round ${round}`,
          matchNumber: matchCounter++,
          teamA: isAlternate ? teamB : teamA,
          teamB: isAlternate ? teamA : teamB
        });
      }
    }

    // Rotate array: keep teams[0] fixed, rotate the rest clockwise
    // [teams[0], teams[last], teams[1], teams[2], ... teams[last-1]]
    const fixed = teams[0];
    const last = teams[teams.length - 1];
    const middle = teams.slice(1, teams.length - 1);
    teams.length = 0;
    teams.push(fixed, last, ...middle);
  }

  return schedule;
}

/**
 * Calculates next power of two >= n
 */
function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) {
    p *= 2;
  }
  return p;
}

/**
 * Returns round display label based on total rounds and round index
 */
function getKnockoutRoundLabel(roundIndex, totalRounds) {
  const remainingRounds = totalRounds - roundIndex;
  if (remainingRounds === 0) return 'Final';
  if (remainingRounds === 1) return 'Semi-Finals';
  if (remainingRounds === 2) return 'Quarter-Finals';
  if (remainingRounds === 3) return 'Round of 16';
  if (remainingRounds === 4) return 'Round of 32';
  return `Round ${roundIndex + 1}`;
}

/**
 * Builds a single-elimination knockout bracket with seeded byes and nextMatch/nextSlot links.
 * Returns match templates to be inserted into DB.
 * @param {Array<string>} participantIds - Array of participant ObjectId strings (ordered by seed or draw)
 * @returns {Array<Object>} match definitions
 */
function generateKnockoutMatches(participantIds) {
  const count = participantIds.length;
  if (count < 2) return [];

  const bracketSize = nextPowerOfTwo(count); // e.g., 8 for 5 teams
  const totalRounds = Math.log2(bracketSize); // e.g., 3 rounds

  // Structure: rounds[r] = array of match objects
  const rounds = [];
  let matchNumber = 1;

  for (let r = 0; r < totalRounds; r++) {
    const matchesInRound = bracketSize / Math.pow(2, r + 1);
    const roundMatches = [];
    const roundLabel = getKnockoutRoundLabel(r, totalRounds - 1);

    for (let m = 0; m < matchesInRound; m++) {
      roundMatches.push({
        tempId: `r${r}_m${m}`,
        round: r + 1,
        roundLabel,
        matchNumber: matchNumber++,
        teamA: null,
        teamB: null,
        nextMatchTempId: null,
        nextSlot: null,
        status: 'scheduled',
        isBye: false,
        result: { scoreA: 0, scoreB: 0, winner: null }
      });
    }
    rounds.push(roundMatches);
  }

  // Link children to parents (r to r+1)
  for (let r = 0; r < totalRounds - 1; r++) {
    for (let m = 0; m < rounds[r].length; m++) {
      const parentMatchIndex = Math.floor(m / 2);
      const parentSlot = (m % 2 === 0) ? 'A' : 'B';
      rounds[r][m].nextMatchTempId = rounds[r + 1][parentMatchIndex].tempId;
      rounds[r][m].nextSlot = parentSlot;
    }
  }

  // Seed the first round with participants and byes
  // Standard bracket seeding: top seeds get byes
  const padded = [...participantIds];
  while (padded.length < bracketSize) {
    padded.push(null); // byes
  }

  // Standard bracket pairing: [0 vs n-1, 1 vs n-2, ...] or sequential pairing
  const firstRoundMatches = rounds[0];
  for (let m = 0; m < firstRoundMatches.length; m++) {
    const tA = padded[m * 2] || null;
    const tB = padded[m * 2 + 1] || null;

    firstRoundMatches[m].teamA = tA;
    firstRoundMatches[m].teamB = tB;

    // Check if one team has a bye
    if (tA && !tB) {
      firstRoundMatches[m].isBye = true;
      firstRoundMatches[m].status = 'completed';
      firstRoundMatches[m].result.winner = 'A';
    } else if (!tA && tB) {
      firstRoundMatches[m].isBye = true;
      firstRoundMatches[m].status = 'completed';
      firstRoundMatches[m].result.winner = 'B';
    }
  }

  // Flatten all matches
  const flatMatches = [];
  for (const r of rounds) {
    flatMatches.push(...r);
  }

  return flatMatches;
}

/**
 * Cross-seeding algorithm for group qualifiers advancing to knockout (Section 6.4)
 * Pairs 1st of Group i with 2nd of Group i+1 (wrapping).
 * @param {Array<{ groupName: string, qualifiers: Array<string> }>} groupQualifiers
 * @returns {Array<string>} ordered participant IDs ready for knockout
 */
function crossSeed(groupQualifiers) {
  if (!groupQualifiers || groupQualifiers.length < 2) {
    return groupQualifiers.flatMap(g => g.qualifiers);
  }

  const seeded = [];
  const numGroups = groupQualifiers.length;

  for (let i = 0; i < numGroups; i++) {
    const firstPlace = groupQualifiers[i].qualifiers[0];
    const nextGroupIndex = (i + 1) % numGroups;
    const secondPlace = groupQualifiers[nextGroupIndex].qualifiers[1];

    if (firstPlace) seeded.push(firstPlace);
    if (secondPlace) seeded.push(secondPlace);
  }

  return seeded;
}

/**
 * Computes dynamic group standings from completed matches (PRD Section 6.1)
 * @param {Array<Object>} matches - Completed matches in the group
 * @param {Array<Object>} participants - Participants in the group
 * @param {Object} rules - Points and tieBreakers config
 * @returns {{ rows: Array<Object>, tiedAtCutoff: boolean }}
 */
function computeStandings(matches = [], participants = [], rules = {}, tieResolutions = [], groupName = '') {
  const winPts = rules.points?.win !== undefined ? rules.points.win : 3;
  const drawPts = rules.points?.draw !== undefined ? rules.points.draw : 1;
  const lossPts = rules.points?.loss !== undefined ? rules.points.loss : 0;
  const tieBreakers = rules.tieBreakers || ['points', 'scoreDifference', 'scoredFor', 'headToHead'];
  const topN = rules.advancement?.topPerGroup || 2;

  // Initialize row for every participant in the group
  const table = new Map();
  for (const p of participants) {
    const pId = (p._id || p).toString();
    const pName = p.name || 'Team';
    table.set(pId, {
      participantId: pId,
      name: pName,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [], // 'W', 'D', 'L'
      qualified: false
    });
  }

  // Record head-to-head match outcomes between teams
  const headToHead = new Map(); // key: "idA-idB", value: { scoreA, scoreB, winner }

  // Process completed matches
  for (const m of matches) {
    if (m.status !== 'completed' || !m.teamA || !m.teamB) continue;

    const idA = (m.teamA._id || m.teamA).toString();
    const idB = (m.teamB._id || m.teamB).toString();

    const rowA = table.get(idA);
    const rowB = table.get(idB);

    if (!rowA || !rowB) continue;

    const scoreA = Number(m.result?.scoreA) || 0;
    const scoreB = Number(m.result?.scoreB) || 0;

    rowA.played += 1;
    rowB.played += 1;

    rowA.goalsFor += scoreA;
    rowA.goalsAgainst += scoreB;
    rowB.goalsFor += scoreB;
    rowB.goalsAgainst += scoreA;

    // Head-to-head tracking
    headToHead.set(`${idA}-${idB}`, { scoreA, scoreB, winner: m.result?.winner });
    headToHead.set(`${idB}-${idA}`, { scoreA: scoreB, scoreB: scoreA, winner: m.result?.winner === 'A' ? 'B' : m.result?.winner === 'B' ? 'A' : 'draw' });

    if (scoreA > scoreB || m.result?.winner === 'A') {
      rowA.won += 1;
      rowA.points += winPts;
      rowA.form.push('W');

      rowB.lost += 1;
      rowB.points += lossPts;
      rowB.form.push('L');
    } else if (scoreB > scoreA || m.result?.winner === 'B') {
      rowB.won += 1;
      rowB.points += winPts;
      rowB.form.push('W');

      rowA.lost += 1;
      rowA.points += lossPts;
      rowA.form.push('L');
    } else {
      rowA.drawn += 1;
      rowA.points += drawPts;
      rowA.form.push('D');

      rowB.drawn += 1;
      rowB.points += drawPts;
      rowB.form.push('D');
    }
  }

  // Calculate goal differences & keep form to last 5 matches
  for (const row of table.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(-5);
  }

  const rows = Array.from(table.values());

  // Sort rows based on points and configured tie-breakers
  rows.sort((a, b) => {
    // 1. Points
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    // 2. Tie-breakers in order
    for (const tb of tieBreakers) {
      if (tb === 'scoreDifference') {
        if (b.goalDifference !== a.goalDifference) {
          return b.goalDifference - a.goalDifference;
        }
      } else if (tb === 'scoredFor') {
        if (b.goalsFor !== a.goalsFor) {
          return b.goalsFor - a.goalsFor;
        }
      } else if (tb === 'wins') {
        if (b.won !== a.won) {
          return b.won - a.won;
        }
      } else if (tb === 'headToHead') {
        const h2h = headToHead.get(`${a.participantId}-${b.participantId}`);
        if (h2h) {
          if (h2h.winner === 'A') return -1;
          if (h2h.winner === 'B') return 1;
        }
      }
    }

    // 3. Check official organizer tie resolution
    if (tieResolutions && Array.isArray(tieResolutions)) {
      const gRes = tieResolutions.find(r => !groupName || r.group === groupName);
      if (gRes && gRes.ranking && gRes.ranking.length > 0) {
        const idAStr = a.participantId.toString();
        const idBStr = b.participantId.toString();
        const idxA = gRes.ranking.findIndex(id => (id._id || id).toString() === idAStr);
        const idxB = gRes.ranking.findIndex(id => (id._id || id).toString() === idBStr);
        if (idxA !== -1 && idxB !== -1) {
          return idxA - idxB;
        }
      }
    }

    return a.name.localeCompare(b.name);
  });

  // Assign position ranks
  rows.forEach((row, idx) => {
    row.position = idx + 1;
    row.qualified = idx < topN;
  });

  // Comprehensive Tie Detection across all rows
  const tiedPairs = [];
  const gRes = (tieResolutions || []).find(r => !groupName || r.group === groupName);

  for (let i = 0; i < rows.length - 1; i++) {
    const r1 = rows[i];
    const r2 = rows[i + 1];

    if (
      r1.points === r2.points &&
      r1.goalDifference === r2.goalDifference &&
      r1.goalsFor === r2.goalsFor &&
      r1.won === r2.won
    ) {
      const h2h = headToHead.get(`${r1.participantId}-${r2.participantId}`);
      if (!h2h || h2h.winner === 'draw') {
        const id1 = r1.participantId.toString();
        const id2 = r2.participantId.toString();
        const isManuallyResolved =
          gRes &&
          gRes.ranking &&
          gRes.ranking.some(id => (id._id || id).toString() === id1) &&
          gRes.ranking.some(id => (id._id || id).toString() === id2);

        if (!isManuallyResolved) {
          tiedPairs.push({
            groupName,
            teamA: { participantId: id1, name: r1.name },
            teamB: { participantId: id2, name: r2.name },
            positions: [i + 1, i + 2],
            isAtCutoff: (i + 1 === topN)
          });
        }
      }
    }
  }

  const tiedAtCutoff = tiedPairs.some(p => p.isAtCutoff);

  return { rows, tiedAtCutoff, tiedPairs };
}

module.exports = {
  roundRobin,
  generateKnockoutMatches,
  crossSeed,
  computeStandings
};
