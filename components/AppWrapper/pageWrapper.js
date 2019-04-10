import styled, { css } from 'styled-components';

const PageWrapper = styled.div`
  padding: 0px 20px;
  max-width: 1400px;
  margin: 0 auto;
  ${({theme}) => css`
    padding-top: ${`calc(${theme.sizes.marginTopPageWrapper}px + ${theme.sizes.headerHeightMobile}px)`};
  `}
  position: relative;

  ${({theme}) => theme.tablet`
    margin-top: ${({theme}) => `${theme.sizes.marginTopPageWrapper}px`};
    padding-top: 0px;
    margin-bottom: 50px;
    min-height: 600px;
  `}

  ${({theme}) => theme.laptop`
    padding: 0px 40px;
  `}

  ${props => props.isFullScreenPage && css`
    margin-top: 0px;
    padding: 0px;
  `}
}`

export default PageWrapper;
