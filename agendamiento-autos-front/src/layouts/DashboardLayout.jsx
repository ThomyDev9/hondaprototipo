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
        background: "#990d0d",
    },
    content: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
    },
    pageContent: {
        padding: "1rem",
        flex: 1,
    },
};
