import styled, { css } from 'styled-components';

const TokenBalanceItemWrapper = styled.div`
  width: 260px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  ${props => !props.enoughFunds && css`
    opacity: 0.7;
  `}
}`

export default TokenBalanceItemWrapper;
