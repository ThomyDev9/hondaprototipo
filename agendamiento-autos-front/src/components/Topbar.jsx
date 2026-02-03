export default function Topbar({ user, onLogout }) {
  return (
    <div style={styles.topbar}>
      <div></div>
      <div style={styles.right}>
        <span style={styles.role}>{(user.roles && user.roles[0]) || 'ADMIN'}</span>

        <span style={styles.name}>{user.email}</span>
        <button style={styles.button} onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

const styles = {
  topbar: {
    height: '60px',
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 1.5rem',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  role: {
    backgroundColor: '#1D4ED8',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    color: 'white',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  name: {
    fontSize: '0.9rem',
    color: '#1E293B',
  },
  button: {
    padding: '0.4rem 0.9rem',
    borderRadius: '999px',
    border: '1px solid #E5E7EB',
    backgroundColor: '#F9FAFB',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};
