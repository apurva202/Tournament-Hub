const PRESETS = {
  football: {
    key: 'football',
    label: 'Football (Soccer)',
    participantType: 'team',
    scoreboardType: 'score',
    scoreLabel: 'Goals',
    allowDraw: true,
    points: { win: 3, draw: 1, loss: 0 },
    tieBreakers: ['points', 'scoreDifference', 'scoredFor', 'headToHead'],
    roster: { min: 5, max: 11 }
  }
};

module.exports = PRESETS;
