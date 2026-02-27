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
        <div style={{ ...styles.wrapper }}>
            <Sidebar
                role={user.roles?.[0]}
                adminPage={adminPage}
                onChangeAdminPage={onChangeAdminPage}
            />
            <div
                style={{
                    ...styles.content,
                    minHeight: "100vh",
                    height: "100vh",
                    overflow: "auto",
                }}
            >
                <Topbar user={user} onLogout={onLogout} />
                <div style={styles.pageContent}>{children}</div>
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        display: "flex",
        background: "#919192",
        minHeight: "100vh",
        height: "100vh",
    },
    content: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        height: "100vh",
        overflow: "auto",
    },
    pageContent: {
        padding: "1rem",
        flex: 1,
    },
};
