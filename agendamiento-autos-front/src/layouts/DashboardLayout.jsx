import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import PropTypes, { node } from "prop-types";

export default function DashboardLayout({
    children,
    user,
    onLogout,
    adminPage,
    onChangeAdminPage,
    selectedAgentStatus,
    onChangeAgentStatus,
    onSelectCampaign,
}) {
    return (
        <div style={{ ...styles.wrapper }}>
            <Sidebar
                role={user.roles?.[0]}
                adminPage={adminPage}
                onChangeAdminPage={onChangeAdminPage}
                onSelectCampaign={onSelectCampaign}
            />
            <div
                style={{
                    ...styles.content,
                    minHeight: "100vh",
                    height: "100vh",
                    overflow: "hidden",
                }}
            >
                <Topbar
                    user={user}
                    onLogout={onLogout}
                    agentStatus={selectedAgentStatus}
                    onChangeAgentStatus={onChangeAgentStatus}
                />
                <div style={styles.pageContent}>{children}</div>
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        display: "flex",
        background: "#919192",
    },
    content: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
    },
};

DashboardLayout.propTypes = {
    children: PropTypes.node,
    user: PropTypes.shape({
        roles: PropTypes.arrayOf(PropTypes.string),
    }),
    onLogout: PropTypes.func,
    adminPage: PropTypes.string,
    onChangeAdminPage: PropTypes.func,
    selectedAgentStatus: PropTypes.string,
    onChangeAgentStatus: PropTypes.func,
    onSelectCampaign: PropTypes.func,
};
