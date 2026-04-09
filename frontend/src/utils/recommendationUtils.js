export const ALL_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
  'Uttarakhand', 'West Bengal'
];

export const ALL_UTS = [
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export const COASTAL_STATES = [
  'Andhra Pradesh', 'Goa', 'Gujarat', 'Karnataka', 'Kerala', 'Maharashtra', 'Odisha', 
  'Tamil Nadu', 'West Bengal'
];

export const COASTAL_UTS = [
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu', 
  'Lakshadweep', 'Puducherry'
];

export const IMB_STATES = ['Arunachal Pradesh', 'Nagaland', 'Manipur', 'Mizoram'];

// Ministries and organizations for dropdown (as per user request)
export const ALL_MINISTRIES = [
  'MEA', 'MHA', 'MOD', 'MoF', 'MORTH', 'MeitY',
  'Ministry of Corporate Affairs', 'Ministry of Education', 'Ministry of Finance',
  'Ministry of Health & Family Welfare', 'Ministry of I&B', 'Ministry of Labour',
  'Ministry of Law & Justice', 'Ministry of Ports, Shipping & Waterways',
  'Ministry of Social Justice & Empowerment', 'Ministry of Tourism',
  'Ministry of Tribal Affairs', 'Ministry of Women & Child Development',
  'Ministry of Youth Affairs & Sports',
  'AAI', 'Assam Rifles', 'BCAS', 'BPR&D', 'BSF', 'CAPFs', 'CAPFs/CPOs',
  'CBDT', 'CBI', 'CISF', 'CPOs', 'DGs of CAPFs/CPOs', 'ED', 'FIU-IND',
  'FS CD & HG', 'I4C', 'IB', 'ITBP', 'NATGRID', 'NCB', 'NCRB', 'NDRF',
  'NFSU', 'NIA', 'NTRO', 'R&AW', 'SSB', 'SVPNPA'
];

export const expandOfficerToken = (token) => {
  if (!token) return null;
  // Clean "Action by", "Actioned by" prefixes and trim
  let t = token.replace(/^(Actioned? by:?\s*)/i, '').trim();
  const tLower = t.toLowerCase();

  // Expansion logic
  if (tLower.includes('dgsp') && tLower.includes('coastal')) return [...COASTAL_STATES, ...COASTAL_UTS];
  if (tLower.includes('dgsp') && (tLower.includes('concerned') || tLower.includes('arunachal'))) {
    if (tLower.includes('arunachal')) {
       const match = t.match(/\(([^)]+)\)/);
       if (match) return match[1].split(',').map(s => s.trim());
    }
    return IMB_STATES;
  }
  if ((tLower.includes('dgsp') || tLower.includes('dgp') || tLower.includes('dgs p')) && (tLower.includes('state') || tLower.includes('ut') || tLower.includes('union'))) {
    if (tLower.includes('west bengal')) return ['West Bengal'];
    return [...ALL_STATES, ...ALL_UTS];
  }
  if (tLower.includes('dgp west bengal')) return ['West Bengal'];
  
  // If it's already a state from our list, return it
  const foundState = ALL_STATES.find(s => s.toLowerCase() === tLower);
  if (foundState) return [foundState];
  const foundUT = ALL_UTS.find(u => u.toLowerCase() === tLower);
  if (foundUT) return [foundUT];

  // Otherwise, return the cleaned token itself (e.g., MHA, CAPFs, IB)
  return [t];
};

export const getAssignedUsers = (actionedByString) => {
  if (!actionedByString) return [];
  const rawTokens = actionedByString.split(',').map(s => s.trim());
  const allUsers = new Set();
  rawTokens.forEach(token => {
    const expanded = expandOfficerToken(token);
    if (expanded) expanded.forEach(u => allUsers.add(u));
  });
  return Array.from(allUsers);
};
