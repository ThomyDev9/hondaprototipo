import "./Progress.css";

function Progress({ value, label, showLabel = true }) {
    const safe = Number.isFinite(value) ? value : 0;

    return (
        <div className="progress">
            <div className="progress__outer">
                <div
                    className="progress__inner"
                    style={{ width: `${safe}%` }}
                />
            </div>
            {showLabel && <span className="progress__label">{safe}%</span>}
        </div>
    );
}

export default Progress;
