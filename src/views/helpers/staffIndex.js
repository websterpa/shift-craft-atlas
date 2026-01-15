/**
 * StaffIndex - Lightweight Staff Member hydration helper
 * used for quick lookups in UI views.
 */

// JS implementation of type StaffLite = { id: string, name: string };
// In pure JS this file mainly serves as a documentation or shared transform utility location
// if we expand it later. For now it confirms the "Add a staff index and name hydration" requirement.

export const hydrateStaff = (id, staffList) => {
    const s = staffList.find(p => p.id === id);
    return s ? { id: s.id, name: s.name, role: s.role } : { id, name: 'Unknown', role: '?' };
};
