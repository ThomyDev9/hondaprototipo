import Sidebar from "../components/Sidebar";
import PropTypes from "prop-types";

export default function DashboardLayout({
    children,
    user,
    onLogout,
    adminPage,
    onChangeAdminPage,
    selectedAgentStatus,
    onChangeAgentStatus,
    onSelectCampaign,
    agentPage,
    onChangeAgentPage,
}) {
    return (
        <div style={{ ...styles.wrapper }}>
            <Sidebar
                user={user}
                role={user.roles?.[0]}
                adminPage={adminPage}
                onChangeAdminPage={onChangeAdminPage}
                onSelectCampaign={onSelectCampaign}
                agentPage={agentPage}
                onChangeAgentPage={onChangeAgentPage}
                onLogout={onLogout}
                agentStatus={selectedAgentStatus}
                onChangeAgentStatus={onChangeAgentStatus}
            />
            <div
                style={{
                    ...styles.content,
                    minHeight: "100vh",
                    height: "100vh",
                    overflow: "hidden",
                }}
            >
                <div style={styles.pageContent}>{children}</div>
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        display: "flex",
        background:
            "linear-gradient(180deg, #e7eefb 0%, #f1f5ff 48%, #f8faff 100%)",
    },
    content: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
    },
    pageContent: {
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        background:
            "radial-gradient(circle at top right, rgba(37,99,235,0.08), transparent 45%)",
    },
};

DashboardLayout.propTypes = {
    children: PropTypes.node,
    user: PropTypes.shape({
        roles: PropTypes.arrayOf(PropTypes.string),
        full_name: PropTypes.string,
        username: PropTypes.string,
        email: PropTypes.string,
    }),
    onLogout: PropTypes.func,
    adminPage: PropTypes.string,
    onChangeAdminPage: PropTypes.func,
    selectedAgentStatus: PropTypes.string,
    onChangeAgentStatus: PropTypes.func,
    onSelectCampaign: PropTypes.func,
    agentPage: PropTypes.string,
    onChangeAgentPage: PropTypes.func,
};
