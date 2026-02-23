import React from "react";
import "./PageContainer.css";

export default function PageContainer({
    title,
    actions,
    fullWidth = false,
    className = "",
    children,
}) {
    return (
        <div
            className={`page-container ${fullWidth ? "full" : ""} ${className}`.trim()}
        >
            {title || actions ? (
                <div className="page-header">
                    {title ? <h2 className="page-title">{title}</h2> : null}
                    {actions ? (
                        <div className="page-actions">{actions}</div>
                    ) : null}
                </div>
            ) : null}

            <div className="page-body">{children}</div>
        </div>
    );
}
