import PropTypes from "prop-types";
import { Fragment } from "react";

export default function BaseCardSection({
    title,
    loading,
    cards,
    emptyMessage,
    renderCard,
    getKey,
}) {
    const hasCards = Array.isArray(cards) && cards.length > 0;

    let content = null;
    if (loading) {
        content = <p className="agent-info-text">Cargando {title.toLowerCase()}...</p>;
    } else if (!hasCards) {
        content = <p className="agent-info-text">{emptyMessage}</p>;
    } else {
        content = (
            <div className="agent-base-cards-grid">
                {cards.map((card, index) => (
                    <Fragment key={getKey(card, index)}>
                        {renderCard(card)}
                    </Fragment>
                ))}
            </div>
        );
    }

    return (
        <section className="agent-base-cards agent-base-cards--home">
            <h2 className="agent-base-cards__title">{title}</h2>
            {content}
        </section>
    );
}

BaseCardSection.propTypes = {
    title: PropTypes.string.isRequired,
    loading: PropTypes.bool,
    cards: PropTypes.array,
    emptyMessage: PropTypes.string,
    renderCard: PropTypes.func.isRequired,
    getKey: PropTypes.func,
};

BaseCardSection.defaultProps = {
    loading: false,
    cards: [],
    emptyMessage: "No hay registros disponibles.",
    getKey: (_, index) => index,
};
