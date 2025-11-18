import './Card.css';

interface CardProps {
  children: React.ReactNode;
  hover?: boolean;
  onClick?: () => void;
  className?: string;
}

const Card = ({ children, hover = false, onClick, className = '' }: CardProps) => {
  const cardClassName = `card ${hover ? 'card-hover' : ''} ${className}`;

  return (
    <div className={cardClassName} onClick={onClick}>
      {children}
    </div>
  );
};

export default Card;
