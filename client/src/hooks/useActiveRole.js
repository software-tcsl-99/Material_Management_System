import useAuthStore from '../store/authStore';

export const useActiveRole = () => {
  const { user } = useAuthStore();
  
  // Fallback to real logged-in user role
  const role = user?.role || 'employee';
  const adminType = user?.departmentAdminType || null;
  let label = 'Employee';
  
  if (role === 'super_admin') label = 'Super Admin';
  else if (role === 'team_lead') label = 'Team Lead';
  else if (role === 'department_admin') {
    if (adminType === 'store') label = 'Store Admin';
    else if (adminType === 'accounts') label = 'Accounts Admin';
    else if (adminType === 'management') label = 'Management Admin';
    else label = 'Dept Admin';
  }

  return { role, adminType, label };
};

export default useActiveRole;
