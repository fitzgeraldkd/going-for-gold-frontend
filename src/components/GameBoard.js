import React, { useEffect, useState } from 'react';
import { useParams, Switch, Route, useHistory } from 'react-router-dom';
import CategoryColumn from './CategoryColumn';
import CurrentPlayers from './CurrentPlayers';
import QuestionDetail from './QuestionDetail';
import styled from 'styled-components';

function GameBoard() {
    const [gameData, setGameData] = useState(null);
    const [answeringPlayer, setAnsweringPlayer] = useState({});
    const [guess, setGuess] = useState('');

    const {gameId} = useParams();
    const history = useHistory();

    useEffect(() => {
        fetch(`${process.env.REACT_APP_API_URL}/games/${gameId}`)
            .then(resp => resp.json())
            .catch(err => {
                console.error(err);
                console.error(gameId);
                console.error(`${process.env.REACT_APP_API_URL}/games?id=${gameId}`);
            })
            .then(data => setGameData(data))
    }, [gameId]);

    function deepCloner(target) {
        if (Array.isArray(target)) {
          return target.map(deepCloner);
        } else if (target instanceof Date) {
          return new Date(target);
        } else if (typeof target === 'object' && target !== null) {
          const newObj = {};
          for (const key in target) {
            newObj[key] = deepCloner(target[key])
          }
          return newObj;
        }
        return target;
      }

    const handlePass = (questionId) => {
        const newCategories = deepCloner(gameData.categories);
        for (let category of newCategories) {
            const questionIndex = category.questions.findIndex(question => question.id === questionId)
            if (questionIndex >= 0) {
                category.questions[questionIndex].completed = true;
                break;
            }
        }
        const options = {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({categories: newCategories})
        }
        fetch(`${process.env.REACT_APP_API_URL}/games/${gameId}`, options)
            .then(resp => resp.json())
            .then(newGameData => {
                setGameData(newGameData);
                setAnsweringPlayer({});
                history.push(`/games/${gameId}`);
            });
    };

    const handleGuessChange = (e) => {
        setGuess(e.target.value);
    };

    const handleGuessSubmit = (e, questionId) => {
        e.preventDefault();
        const newCategories = deepCloner(gameData.categories);
        let question;
        for (let category of newCategories) {
            question = category.questions.find(question => question.id === questionId)
            if (question) break;
        }
        if (question) {
            const correct = guess.toLowerCase() === question.answer.toLowerCase();
            console.log('Correct:', correct);
            const newPlayerData = deepCloner(gameData.players);
            console.log(newPlayerData[0].id);
            console.log(answeringPlayer.id);
            const playerObj = newPlayerData.find(player => player.playerId === answeringPlayer.id);
            playerObj.winnings += question.value * (correct ? 1 : -1);
            const newData = {players: newPlayerData};
            if (correct) {
                question.completed = true;
                newData.categories = newCategories;
                newData.boardControl = answeringPlayer.id;
            }

            const options = {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newData)
            };
            fetch(`${process.env.REACT_APP_API_URL}/games/${gameId}`, options)
                .then(resp => resp.json())
                .then(newGameData => {
                    setGameData(newGameData);
                    setAnsweringPlayer({});
                    if (correct) history.push(`/games/${gameId}`);
                });
        } else {
            console.error(`Question, ${questionId}, not found.`);
        }
    };

    const handlePlayerClick = (playerInfo) => {
        if (history.location.pathname.includes('/questions/')) {
            setGuess('');
            setAnsweringPlayer(playerInfo);
        }
    };

    const handlePayout = () => {
        const winningPlayer = gameData.players.reduce((prev, curr) => (prev.winnings > curr.winnings ? prev : curr), gameData.players[0])
        console.log(winningPlayer);
        fetch(`${process.env.REACT_APP_API_URL}/players/${winningPlayer.playerId}`)
            .then(resp => resp.json())
            .then(winningPlayerInfo => {
                const options = {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({winnings: winningPlayerInfo.winnings + winningPlayer.winnings})
                }
                fetch(`${process.env.REACT_APP_API_URL}/players/${winningPlayer.playerId}`, options)
                    .then(resp => resp.json())
                    .then(updatedPlayer => {
                        const options = {
                            method: 'DELETE'
                        }
                        fetch(`${process.env.REACT_APP_API_URL}/games/${gameId}`, options)
                            .then(() => history.push('/'))
                    })
            })
    }

    if (!gameData) return <div className='game-container'><h1 style={{color: 'white', margin: 0, padding: '20px'}}>Loading</h1></div>;

    if (Object.keys(gameData).length === 0) return <div className='game-container'><h1 style={{color: 'white', margin: 0, padding: '20px'}}>Invalid request</h1></div>;

    const activePlayer = !history.location.pathname.includes('/questions/') ? gameData.boardControl : answeringPlayer.id;

    return (
        <div>
            <QuestionBoard>
                <Switch>
                    <Route path='/games/:gameId/questions/:questionId'>
                        <QuestionDetail gameData={gameData} handlePass={handlePass} guess={guess} handleGuessChange={handleGuessChange} handleGuessSubmit={handleGuessSubmit} answeringPlayer={answeringPlayer} />
                    </Route>
                    <Route path='/games/:gameId'>
                        {gameData.categories.map(category => <CategoryColumn key={category.id} category={category} />)}
                    </Route>
                </Switch>
            </QuestionBoard>
            <div>
                <CurrentPlayers players={gameData.players} activePlayer={activePlayer} handlePlayerClick={handlePlayerClick} />
            </div>
            <div>
                <CloseButton onClick={handlePayout}>Close Game and Pay Out</CloseButton>
            </div>
        </div>
    );
}

export default GameBoard;

const QuestionBoard = styled.div`
    display: flex;
    font-family: ${props => props.theme.fonts.sansSerif};
    justify-content: center;
    margin-bottom: 10px;
    div {
        font-weight: bolder;
    }
`;

const CloseButton = styled.button`
    cursor: pointer;
    border: 3px solid #f00;
    border-radius: 10px;
    color: ${props => props.theme.colors.jeopardyYellow};
    text-shadow: 1px 1px black;
    background-color: ${props => props.theme.colors.jeopardyBlue};
    padding: 10px;
    font-family: ${props => props.theme.fonts.sansSerif};
    font-size: large;
    display: block;
    margin: auto;
    margin-top: 20px;
    transition: background-color 0.25s;
    &:hover {
        background-color: ${props => props.theme.colors.jeopardyDarkBlue};
    }
`;