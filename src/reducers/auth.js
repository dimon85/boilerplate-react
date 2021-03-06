import isFunction from 'lodash/isFunction';
import api from '../api';
import { getConfig } from '../../config';
import { showError } from '../helpers/uiHelper';
import cookieHelper from '../helpers/cookieHelper';

// TYPE
export const LOAD_PROFILE_SUCCESS = 'redux-ducks/auth/LOAD_PROFILE_SUCCESS';
export const LOGIN_SUCCESS = 'redux-ducks/auth/LOGIN_SUCCESS';
export const SET_DEFAULT = 'redux-ducks/auth/SET_DEFAULT';

export const LOAD_INFO = 'redux-ducks/auth/LOAD_INFO';
export const LOAD_INFO_SUCCESS = 'redux-ducks/auth/LOAD_INFO_SUCCESS';
export const LOAD_INFO_FAIL = 'redux-ducks/auth/LOAD_INFO_FAIL';

export const AUTH_LOADED = 'redux-ducks/auth/AUTH_LOADED';
export const UPDATE_PROFILE_SUCCESS = 'redux-ducks/auth/UPDATE_PROFILE_SUCCESS';

const initialState = {
  loading: false,
  loaded: false,
  error: null,
  current: {
    type: 'guest',
  },
  userInfo: {
    loading: false,
    loaded: false,
  },
  token: false,
};

// ACTIONS
export const setDefault = () => ({
  type: SET_DEFAULT
});

const login = payload => ({
  type: LOGIN_SUCCESS,
  result: payload,
});

const getProfile = payload => ({
  type: LOAD_PROFILE_SUCCESS,
  result: payload,
});

const update = payload => ({
  type: UPDATE_PROFILE_SUCCESS,
  result: payload,
});

const setAuthLoaded = () => ({
  type: AUTH_LOADED,
});

const loadInfoBegin = () => ({
  type: LOAD_INFO,
});

const loadInfoResult = data => ({
  type: LOAD_INFO_SUCCESS,
  result: data,
});

const loadInfoError = () => ({
  type: LOAD_INFO_FAIL,
});

export const loginAction = payload => async (dispatch) => {
  try {
    const data = await api.auth.login('auth/login', payload);
    
    return dispatch(login(data));
  } catch (error) {
    const { status, statusText } = error;

    if (!status) {
      showError('Something went wrong. Try later');
    }

    if (status === 500) {
      showError(statusText);
    }

    throw error;
  }
};

export const signupAction = payload => async (dispatch) => {
  try {
    const data = await api.auth.signup('auth/register', payload);

    return dispatch(login(data));
  } catch (error) {
    const { data, status, statusText } = error;

    if (!data || !data.errors) {
      showError('Something went wrong. Try later');
    }

    if (status === 500) {
      showError(statusText);
    }

    throw error;
  }
};

export const loadAuth = () => async (dispatch) => {
  if (!cookieHelper.get('token')) {
    dispatch(setAuthLoaded());
    return ({ error: 'token not found' });
  }

  try {
    const data = await api.auth.profile('auth/profile');

    return dispatch(getProfile(data));
  } catch (error) {
    dispatch(setDefault());
    const { data, status, statusText } = error;

    if (!data || !data.errors) {
      showError('Something went wrong. Try later');
    }

    if (status === 500) {
      showError(statusText);
    }

    throw error;
  }
};

export const logoutAction = () => (dispatch) => {
  cookieHelper.remove('token');

  if (!cookieHelper.get('token')) {
    dispatch(setDefault());
    return Promise.resolve(true);
  }

  Promise.reject({ errors: { token:  'Enable delete token' }});
};

export const updateProfile = (payload) => async (dispatch) => {
  try {
    const data = await api.auth.update('auth/update', payload);
    return dispatch(update(data));
  } catch (error) {
    const { status, statusText } = error;

    if (status === 404) {
      showError(statusText);
    }

    throw error;
  }
};

// MUTATIONS
const loginRequestSuccess = action => (state) => {
  const { token } = action.result;
  api.auth.setAuthToken(token);
  cookieHelper.set('token', token);

  return {
    ...state,
    token: true,
  };
}

/**
 * Load information about User from ipstack.com
 */
export const loadMemberInfoAction = () => (dispatch) => {
  dispatch(loadInfoBegin());

  return api.ApiClient.getExternal(`${getConfig().GET_IP_URL}?access_key=${getConfig().IP_STACK_KEY}&format=1`)
    .then((resp) => {
      dispatch(loadInfoResult(resp));
      return resp;

    }).catch(() => {
      dispatch(loadInfoError());
    });
};


const profileRequestSuccess = action => (state) => {
  const { user } = action.result;
  return {
    ...state,
    loading: false,
    loaded: true,
    current: {
      type: 'member',
      ...user,
    }
  };
}

const updateProfileSuccess = action => state => ({
  ...state,
  current: {
    ...state.current,
    ...action.result.user,
  },
});

const loadInfoStart = () => state => ({
  ...state,
  userInfo: {
    ...state.userInfo,
    loading: true,
  }
});

const loadInfoSuccess = action => state => ({
  ...state,
  userInfo: {
    ...state.userInfo,
    loaded: true,
    loading: false,
    ...action.result,
  }
});

const loadInfoFail = () => state => ({
  ...state,
  userInfo: {
    ...state.userInfo,
    loaded: true,
    loading: false,
  }
});

const setAuthLoadedSuccess = () => state => ({
  ...state,
  loaded: true,
})

const setDefaultSuccess = () => {
  cookieHelper.remove('token');
  return {
    ...initialState,
    loaded: true,
  };
};

const actionsLookup = {
  [LOGIN_SUCCESS]: (state, action) => loginRequestSuccess(action)(state),
  [LOAD_PROFILE_SUCCESS]:  (state, action) => profileRequestSuccess(action)(state),
  [LOAD_INFO]: state => loadInfoStart()(state),
  [LOAD_INFO_SUCCESS]: (state, action) => loadInfoSuccess(action)(state),
  [LOAD_INFO_FAIL]: state => loadInfoFail()(state),
  [AUTH_LOADED]: state => setAuthLoadedSuccess()(state),
  [UPDATE_PROFILE_SUCCESS]: (state, action) => updateProfileSuccess(action)(state),
  [SET_DEFAULT]: () => setDefaultSuccess(),
};

export default function reducer(state = initialState, action) {
  if (isFunction(actionsLookup[action.type])) return actionsLookup[action.type](state, action);

  return state;
}