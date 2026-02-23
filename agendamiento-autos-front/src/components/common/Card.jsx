import "./Card.css";

function Card({ label, value, highlight, color, children }) {
    return (
        <div className={`card ${highlight ? "card--highlight" : ""}`}>
            {children ? (
                children
            ) : (
                <>
                    <span className="card__label">{label}</span>
                    <span
                        className="card__value"
                        style={color ? { color } : {}}
                    >
                        {value ?? 0}
                    </span>
                </>
            )}
        </div>
    );
}

export default Card;
