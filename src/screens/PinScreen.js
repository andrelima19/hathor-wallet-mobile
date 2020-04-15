/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { connect } from 'react-redux';
import { t } from 'ttag';

import {
  BackHandler, Image, SafeAreaView, Text, View,
} from 'react-native';
import * as Keychain from 'react-native-keychain';
import hathorLib from '@hathor/wallet-lib';
import SimpleButton from '../components/SimpleButton';
import PinInput from '../components/PinInput';
import Logo from '../components/Logo';
import { isBiometryEnabled, getSupportedBiometry } from '../utils';
import { lockScreen, unlockScreen, setLoadHistoryStatus } from '../actions';


/**
 * loadHistoryActive {bool} whether we still need to load history
 */
const mapStateToProps = (state) => ({
  loadHistoryActive: state.loadHistoryStatus.active,
});

const mapDispatchToProps = (dispatch) => ({
  unlockScreen: () => dispatch(unlockScreen()),
  lockScreen: () => dispatch(lockScreen()),
  setLoadHistoryStatus: (active, error) => dispatch(setLoadHistoryStatus(active, error)),
});

class PinScreen extends React.Component {
  static defaultProps = { isLockScreen: false };

  constructor(props) {
    super(props);
    /**
     * pin {string} Pin entered by the user
     * error {string} Error message (null if there's no error)
     */
    this.state = {
      pin: '',
      pinColor: 'black',
      error: null,
    };

    this.canCancel = false;
    this.screenText = t`Enter your PIN Code `;
    this.biometryText = t`Unlock Hathor Wallet`;
    if (!this.props.isLockScreen) {
      this.canCancel = props.navigation.getParam('canCancel', this.canCancel);
      this.screenText = props.navigation.getParam('screenText', this.screenText);
      this.biometryText = props.navigation.getParam('biometryText', this.biometryText);
    }

    this.willFocusEvent = null;
  }

  componentDidMount() {
    const supportedBiometry = getSupportedBiometry();
    const biometryEnabled = isBiometryEnabled();
    if (supportedBiometry && biometryEnabled) {
      this.askBiometricId();
    }

    if (!this.canCancel) {
      // If can't cancel this screen, we must remove the hardware back from android
      BackHandler.addEventListener('hardwareBackPress', this.handleBackButton);
    }

    this.willFocusEvent = this.props.navigation.addListener('willFocus', () => {
      this.setState({ pin: '', pinColor: 'black', error: null });
    });
  }

  componentWillUnmount() {
    if (!this.canCancel) {
      // Removing event listener
      BackHandler.removeEventListener('hardwareBackPress', this.handleBackButton);
    }

    // Removing focus event
    this.willFocusEvent.remove();
  }

  handleBackButton = () => true

  askBiometricId = () => {
    Keychain.getGenericPassword({ authenticationPrompt: this.biometryText }).then((credentials) => {
      this.dismiss(credentials.password);
    }, (error) => {
      // no need to do anything as user can enter pin
    });
  }

  dismiss = (pin) => {
    if (this.props.isLockScreen) {
      // in case it's the lock screen, we just have to change redux state. No need
      // to execute callback or go back on navigation
      this.props.unlockScreen();
    } else {
      // dismiss the pin screen first because doing it after the callback can
      // end up dismissing the wrong screen
      this.props.navigation.goBack();
      // execute the callback passing the pin, if any cb was given
      const cb = this.props.navigation.getParam('cb', null);
      if (cb) {
        cb(pin);
      }
    }
  }

  onChangeText = (text) => {
    if (text.length === 6) {
      setTimeout(() => this.validatePin(text), 300);
    }
    this.setState({ pin: text, pinColor: 'black', error: null });
  }

  validatePin = (text) => {
    if (hathorLib.wallet.isPinCorrect(text)) {
      this.dismiss(text);
    } else {
      this.removeOneChar();
    }
  }

  goToReset = () => {
    // navigate to reset screen
    this.props.navigation.navigate('ResetWallet', { onBackPress: () => this.backFromReset() });
    // make sure we won't show loadHistory screen
    this.props.setLoadHistoryStatus(false, false);
    // unlock so we remove this lock screen
    this.props.unlockScreen();
  }

  /*
   * This function is used when coming back to lock screen from reset screen
   */
  backFromReset = () => {
    // set to same status as before
    this.props.setLoadHistoryStatus(this.props.loadHistoryActive, false);
    // show lock screen again
    this.props.lockScreen();
    // navigate to dashboard (will be hidden under lock screen)
    this.props.navigation.navigate('Dashboard');
  }

  removeOneChar = () => {
    const pin = this.state.pin.slice(0, -1);
    if (pin.length === 0) {
      this.setState({ pin: '', error: t`Incorrect PIN Code. Try again.` });
    } else {
      this.setState({ pin, pinColor: '#DE3535' });
      setTimeout(() => this.removeOneChar(), 25);
    }
  }

  render() {
    const renderButton = () => {
      let title;
      let onPress;
      if (this.canCancel) {
        title = t`Cancel`;
        onPress = () => this.props.navigation.goBack();
      } else {
        title = t`Reset wallet`;
        onPress = () => this.goToReset();
      }
      return (
        <SimpleButton
          onPress={onPress}
          title={title}
          textStyle={{
            textTransform: 'uppercase', color: 'rgba(0, 0, 0, 0.5)', letterSpacing: 1, padding: 4,
          }}
          containerStyle={{ marginTop: 16, marginBottom: 8 }}
        />
      );
    };

    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', marginHorizontal: 16 }}>
        <View style={{ marginVertical: 16, alignItems: 'center', height: 21, width: 120 }}>
          <Logo
            style={{ height: 21, width: 120 }}
          />
        </View>
        <Text style={{ marginTop: 32, marginBottom: 16 }}>{this.screenText}</Text>
        <PinInput
          maxLength={6}
          color={this.state.pinColor}
          value={this.state.pin}
          onChangeText={this.onChangeText}
          error={this.state.error}
        />
        {renderButton()}
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(PinScreen);
