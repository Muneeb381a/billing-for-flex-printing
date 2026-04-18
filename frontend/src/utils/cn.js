// Merge class names, filtering out falsy values
const cn = (...classes) => classes.flat().filter(Boolean).join(' ');
export default cn;
