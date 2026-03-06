import PropTypes from "prop-types";
import Select from "./Select";

export default function TwoSelectRow({
    first,
    second,
    marginBottom = "0.6rem",
}) {
    return (
        <div
            style={{
                marginBottom,
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(260px, 1fr))",
                gap: "0.6rem",
                alignItems: "end",
            }}
        >
            <Select
                label={first.label}
                options={first.options}
                value={first.value}
                onChange={first.onChange}
                placeholder={first.placeholder}
                disabled={Boolean(first.disabled)}
                required={Boolean(first.required)}
            />

            <Select
                label={second.label}
                options={second.options}
                value={second.value}
                onChange={second.onChange}
                placeholder={second.placeholder}
                disabled={Boolean(second.disabled)}
                required={Boolean(second.required)}
            />
        </div>
    );
}

const selectShape = PropTypes.shape({
    label: PropTypes.string,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string,
            label: PropTypes.string,
        }),
    ),
    value: PropTypes.string,
    onChange: PropTypes.func,
    placeholder: PropTypes.string,
    disabled: PropTypes.bool,
    required: PropTypes.bool,
});

TwoSelectRow.propTypes = {
    first: selectShape.isRequired,
    second: selectShape.isRequired,
    marginBottom: PropTypes.string,
};
