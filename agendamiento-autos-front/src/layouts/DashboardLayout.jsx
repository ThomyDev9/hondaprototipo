import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function DashboardLayout({
    children,
    user,
    onLogout,
    adminPage,
    onChangeAdminPage,
}) {
    return (
        <div style={styles.wrapper}>
            <Sidebar
                role={user.roles?.[0]}
                adminPage={adminPage}
                onChangeAdminPage={onChangeAdminPage}
            />
            <div style={styles.content}>
                <Topbar user={user} onLogout={onLogout} />
                <div style={styles.pageContent}>{children}</div>
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        background: "#f5f5f5",
    },
    content: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
    },
    pageContent: {
        padding: "2rem",
        flex: 1,
    },
};
